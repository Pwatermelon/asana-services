package compare

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// Report — результат preview merge (общий для CLI и JSON для API).
type Report struct {
	Base           FileStats       `json:"base"`
	Incoming       FileStats       `json:"incoming"`
	StructureOK    bool            `json:"structure_compatible_heuristic"`
	Summary        Summary         `json:"summary"`
	Added          []Entity        `json:"added"`
	Removed        []Entity        `json:"removed"`
	CommonSample   []Entity        `json:"common_sample"`
	LabelConflicts []LabelConflict `json:"label_conflicts"`
	Notes          []string        `json:"notes"`
}

type FileStats struct {
	Filename           string `json:"filename"`
	Classes            int    `json:"classes"`
	ObjectProperties   int    `json:"object_properties"`
	DatatypeProperties int    `json:"datatype_properties"`
	Triples            int    `json:"triples"`
	Entities           int    `json:"entities"`
}

type Summary struct {
	Added          int `json:"added"`
	Removed        int `json:"removed"`
	Common         int `json:"common"`
	LabelConflicts int `json:"label_conflicts"`
}

type Entity struct {
	IRI   string   `json:"iri"`
	Label string   `json:"label"`
	Types []string `json:"types"`
}

type LabelConflict struct {
	IRI           string `json:"iri"`
	BaseLabel     string `json:"base_label"`
	IncomingLabel string `json:"incoming_label"`
}

type entityAcc struct {
	types map[string]struct{}
	label string
}

var (
	reTurtleType  = regexp.MustCompile(`(?m)^\s*(<[^>]+>|[A-Za-z0-9_.:-]+)\s+a\s+([^;.]+)\s*[;.]`)
	reTurtleLabel = regexp.MustCompile(`(?m)^\s*(<[^>]+>|[A-Za-z0-9_.:-]+)\s+rdfs:label\s+"([^"]*)"`)
	reIRIBracket  = regexp.MustCompile(`^<([^>]+)>$`)
)

// CompareFiles сравнивает два OWL/TTL файла.
func CompareFiles(basePath, incomingPath string) (*Report, error) {
	baseRaw, err := os.ReadFile(basePath)
	if err != nil {
		return nil, fmt.Errorf("base: %w", err)
	}
	incRaw, err := os.ReadFile(incomingPath)
	if err != nil {
		return nil, fmt.Errorf("incoming: %w", err)
	}
	return CompareBytes(baseRaw, incRaw, filepath.Base(basePath), filepath.Base(incomingPath))
}

func CompareBytes(baseRaw, incRaw []byte, baseName, incName string) (*Report, error) {
	baseEnt, baseSig, err := parseOntology(baseRaw, baseName)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", baseName, err)
	}
	incEnt, incSig, err := parseOntology(incRaw, incName)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", incName, err)
	}

	baseIDs := keys(baseEnt)
	incIDs := keys(incEnt)
	addedIDs := diffSorted(incIDs, baseIDs)
	removedIDs := diffSorted(baseIDs, incIDs)
	commonIDs := intersectSorted(baseIDs, incIDs)

	var conflicts []LabelConflict
	for _, iri := range commonIDs {
		lb := baseEnt[iri].label
		li := incEnt[iri].label
		if lb != "" && li != "" && lb != li {
			conflicts = append(conflicts, LabelConflict{
				IRI: iri, BaseLabel: lb, IncomingLabel: li,
			})
		}
	}

	structureOK := abs(baseSig.ObjectProperties-incSig.ObjectProperties) <= max(2, baseSig.ObjectProperties/10) &&
		abs(baseSig.DatatypeProperties-incSig.DatatypeProperties) <= max(2, baseSig.DatatypeProperties/10)

	baseSig.Filename = baseName
	baseSig.Entities = len(baseEnt)
	incSig.Filename = incName
	incSig.Entities = len(incEnt)

	return &Report{
		Base:        baseSig,
		Incoming:    incSig,
		StructureOK: structureOK,
		Summary: Summary{
			Added:          len(addedIDs),
			Removed:        len(removedIDs),
			Common:         len(commonIDs),
			LabelConflicts: len(conflicts),
		},
		Added:          toEntities(addedIDs, incEnt, 200),
		Removed:        toEntities(removedIDs, baseEnt, 200),
		CommonSample:   toEntities(commonIDs, baseEnt, 50),
		LabelConflicts: capConflicts(conflicts, 100),
		Notes: []string{
			"Сравнение по IRI сущностей с rdf:type (упрощённый ABox/TBox diff).",
			"Ядро — Go-бинарник; HTTP API — тонкая Python-обёртка.",
			"Preview only: файлы не изменяются.",
		},
	}, nil
}

func (r *Report) JSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

func parseOntology(raw []byte, name string) (map[string]*entityAcc, FileStats, error) {
	ext := strings.ToLower(filepath.Ext(name))
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return nil, FileStats{}, fmt.Errorf("пустой файл")
	}
	switch {
	case strings.HasPrefix(trimmed, "<") || ext == ".owl" || ext == ".rdf" || ext == ".xml":
		return parseRDFXML(raw)
	case ext == ".ttl" || ext == ".n3" || looksLikeTurtle(trimmed):
		return parseTurtleLite(raw)
	default:
		// пробуем XML, потом turtle
		if ent, sig, err := parseRDFXML(raw); err == nil && len(ent) > 0 {
			return ent, sig, nil
		}
		return parseTurtleLite(raw)
	}
}

func looksLikeTurtle(s string) bool {
	return strings.Contains(s, "@prefix") || strings.Contains(s, " a ")
}

func parseRDFXML(raw []byte) (map[string]*entityAcc, FileStats, error) {
	dec := xml.NewDecoder(strings.NewReader(string(raw)))
	dec.Strict = false
	entities := map[string]*entityAcc{}
	sig := FileStats{}
	var stack []xml.StartElement
	var currentIRI string
	var captureLabel bool
	var labelBuf strings.Builder

	skipTypes := map[string]bool{
		"http://www.w3.org/2002/07/owl#Ontology":              true,
		"http://www.w3.org/2002/07/owl#Restriction":           true,
		"http://www.w3.org/2000/01/rdf-schema#Class":          true,
		"http://www.w3.org/1999/02/22-rdf-syntax-ns#Property": true,
	}

	ensure := func(iri string) *entityAcc {
		if e, ok := entities[iri]; ok {
			return e
		}
		e := &entityAcc{types: map[string]struct{}{}}
		entities[iri] = e
		return e
	}

	attr := func(se xml.StartElement, local string) string {
		for _, a := range se.Attr {
			if a.Name.Local == local {
				return a.Value
			}
		}
		return ""
	}

	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, FileStats{}, fmt.Errorf("xml: %w", err)
		}
		switch t := tok.(type) {
		case xml.StartElement:
			stack = append(stack, t)
			about := attr(t, "about")
			if about == "" {
				about = attr(t, "ID")
				if about != "" && !strings.Contains(about, "://") {
					// относительный rdf:ID — оставляем как есть с #
					about = "#" + about
				}
			}
			resource := attr(t, "resource")
			local := t.Name.Local
			space := t.Name.Space

			if about != "" {
				currentIRI = about
				// типизированный элемент вида <owl:Class rdf:about="...">
				typeIRI := expandType(space, local)
				if typeIRI != "" && !skipTypes[typeIRI] {
					ensure(currentIRI).types[typeIRI] = struct{}{}
					bumpSig(&sig, typeIRI)
				}
			}

			if local == "type" && (space == "" || strings.Contains(space, "rdf-syntax")) {
				if currentIRI != "" && resource != "" && !skipTypes[resource] {
					ensure(currentIRI).types[resource] = struct{}{}
					bumpSig(&sig, resource)
					sig.Triples++
				}
			}
			if local == "label" && (space == "" || strings.Contains(space, "rdf-schema") || strings.Contains(space, "rdfs")) {
				captureLabel = true
				labelBuf.Reset()
			}
			sig.Triples++
		case xml.CharData:
			if captureLabel {
				labelBuf.Write([]byte(t))
			}
		case xml.EndElement:
			if captureLabel && t.Name.Local == "label" {
				if currentIRI != "" {
					ensure(currentIRI).label = strings.TrimSpace(labelBuf.String())
				}
				captureLabel = false
			}
			if len(stack) > 0 {
				stack = stack[:len(stack)-1]
			}
			// сброс currentIRI при закрытии элемента с about — упрощённо при пустом стеке типизации
			if len(stack) <= 1 {
				currentIRI = ""
			}
		}
	}

	// убрать сущности без типов (шум)
	for iri, e := range entities {
		if len(e.types) == 0 {
			delete(entities, iri)
		}
	}
	return entities, sig, nil
}

func expandType(space, local string) string {
	if local == "" || local == "RDF" || local == "Ontology" {
		return ""
	}
	switch {
	case strings.Contains(space, "owl") || local == "Class" || local == "ObjectProperty" ||
		local == "DatatypeProperty" || local == "NamedIndividual" || local == "AnnotationProperty":
		if space == "" {
			return "http://www.w3.org/2002/07/owl#" + local
		}
		if strings.HasSuffix(space, "#") || strings.HasSuffix(space, "/") {
			return space + local
		}
		return space + "#" + local
	case strings.Contains(space, "rdf-schema") && local == "Class":
		return "http://www.w3.org/2000/01/rdf-schema#Class"
	default:
		if space == "" {
			return ""
		}
		if strings.HasSuffix(space, "#") || strings.HasSuffix(space, "/") {
			return space + local
		}
		return space + "#" + local
	}
}

func bumpSig(sig *FileStats, typeIRI string) {
	switch typeIRI {
	case "http://www.w3.org/2002/07/owl#Class":
		sig.Classes++
	case "http://www.w3.org/2002/07/owl#ObjectProperty":
		sig.ObjectProperties++
	case "http://www.w3.org/2002/07/owl#DatatypeProperty":
		sig.DatatypeProperties++
	}
}

func parseTurtleLite(raw []byte) (map[string]*entityAcc, FileStats, error) {
	text := string(raw)
	prefixes := map[string]string{}
	rePrefix := regexp.MustCompile(`@prefix\s+(\w*):?\s+<([^>]+)>\s*\.`)
	for _, m := range rePrefix.FindAllStringSubmatch(text, -1) {
		prefixes[m[1]] = m[2]
	}
	expand := func(term string) string {
		term = strings.TrimSpace(term)
		if m := reIRIBracket.FindStringSubmatch(term); m != nil {
			return m[1]
		}
		if strings.HasPrefix(term, ":") {
			return prefixes[""] + strings.TrimPrefix(term, ":")
		}
		if i := strings.Index(term, ":"); i > 0 {
			p, local := term[:i], term[i+1:]
			if base, ok := prefixes[p]; ok {
				return base + local
			}
		}
		return term
	}

	entities := map[string]*entityAcc{}
	sig := FileStats{}
	ensure := func(iri string) *entityAcc {
		if e, ok := entities[iri]; ok {
			return e
		}
		e := &entityAcc{types: map[string]struct{}{}}
		entities[iri] = e
		return e
	}

	for _, m := range reTurtleType.FindAllStringSubmatch(text, -1) {
		subj := expand(m[1])
		for _, part := range strings.Split(m[2], ",") {
			typ := expand(strings.TrimSpace(part))
			if typ == "" {
				continue
			}
			ensure(subj).types[typ] = struct{}{}
			bumpSig(&sig, typ)
			sig.Triples++
		}
	}
	for _, m := range reTurtleLabel.FindAllStringSubmatch(text, -1) {
		subj := expand(m[1])
		ensure(subj).label = m[2]
		sig.Triples++
	}
	if len(entities) == 0 {
		return nil, FileStats{}, fmt.Errorf("не удалось извлечь сущности (нужен OWL/RDF/XML или простой Turtle)")
	}
	return entities, sig, nil
}

func toEntities(ids []string, src map[string]*entityAcc, limit int) []Entity {
	out := make([]Entity, 0, min(len(ids), limit))
	for i, iri := range ids {
		if i >= limit {
			break
		}
		e := src[iri]
		types := keysSet(e.types)
		label := e.label
		if label == "" {
			label = shortID(iri)
		}
		out = append(out, Entity{IRI: iri, Label: label, Types: types})
	}
	return out
}

func keys(m map[string]*entityAcc) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func keysSet(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	if len(out) > 8 {
		out = out[:8]
	}
	return out
}

func diffSorted(a, b []string) []string {
	set := map[string]struct{}{}
	for _, x := range b {
		set[x] = struct{}{}
	}
	var out []string
	for _, x := range a {
		if _, ok := set[x]; !ok {
			out = append(out, x)
		}
	}
	return out
}

func intersectSorted(a, b []string) []string {
	set := map[string]struct{}{}
	for _, x := range b {
		set[x] = struct{}{}
	}
	var out []string
	for _, x := range a {
		if _, ok := set[x]; ok {
			out = append(out, x)
		}
	}
	return out
}

func capConflicts(in []LabelConflict, n int) []LabelConflict {
	if len(in) <= n {
		return in
	}
	return in[:n]
}

func shortID(iri string) string {
	if i := strings.LastIndex(iri, "#"); i >= 0 && i+1 < len(iri) {
		return iri[i+1:]
	}
	if i := strings.LastIndex(iri, "/"); i >= 0 && i+1 < len(iri) {
		return iri[i+1:]
	}
	return iri
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

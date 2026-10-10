package ui

import (
	"fmt"
	"os"
	"strings"

	"github.com/Pwatermelon/asana-ontology-merge/internal/compare"
	"github.com/charmbracelet/lipgloss"
)

var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#E8F5E9")).
			Background(lipgloss.Color("#2D5A46")).
			Padding(0, 1).
			MarginBottom(1)

	subtitleStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#8FA396"))

	okStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("#3DDC97")).Bold(true)
	warnStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#F0C674")).Bold(true)
	badStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#FF6B6B")).Bold(true)
	dimStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#6A756E"))
	iriStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#9BB0A3"))

	cardStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#3D6B56")).
			Padding(0, 1).
			MarginRight(1)

	addHead = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#3DDC97"))
	remHead = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FF6B6B"))
	cnfHead = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#F0C674"))
)

func RenderReport(r *compare.Report, limit int) {
	out := os.Stdout
	fmt.Fprintln(out, titleStyle.Render(" asana-ontology-merge · preview "))
	fmt.Fprintf(out, "%s  %s  %s\n\n",
		subtitleStyle.Render(r.Base.Filename),
		subtitleStyle.Render("↔"),
		subtitleStyle.Render(r.Incoming.Filename),
	)

	cards := lipgloss.JoinHorizontal(lipgloss.Top,
		statCard("добавятся", r.Summary.Added, okStyle),
		statCard("удалятся*", r.Summary.Removed, badStyle),
		statCard("общие", r.Summary.Common, lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#E0E7E3"))),
		statCard("конфликт меток", r.Summary.LabelConflicts, warnStyle),
	)
	fmt.Fprintln(out, cards)

	structLine := okStyle.Render("структура: похоже совместима")
	if !r.StructureOK {
		structLine = warnStyle.Render("структура: возможны расхождения TBox")
	}
	fmt.Fprintln(out, structLine)
	fmt.Fprintln(out, dimStyle.Render("* «удалятся» — при полной замене base; при union обычно сохраняются"))
	fmt.Fprintln(out)

	renderEntityBlock(addHead.Render("＋ Добавятся"), r.Added, limit)
	renderEntityBlock(remHead.Render("− Отсутствуют в кандидате"), r.Removed, limit)

	if len(r.LabelConflicts) > 0 {
		fmt.Fprintln(out, cnfHead.Render("⚠ Конфликты меток"))
		for i, c := range r.LabelConflicts {
			if i >= limit {
				fmt.Fprintln(out, dimStyle.Render(fmt.Sprintf("… ещё %d", len(r.LabelConflicts)-limit)))
				break
			}
			fmt.Fprintf(out, "  %s\n    %s → %s\n",
				iriStyle.Render(c.IRI),
				c.BaseLabel,
				c.IncomingLabel,
			)
		}
		fmt.Fprintln(out)
	}
}

func statCard(label string, value int, valueStyle lipgloss.Style) string {
	body := fmt.Sprintf("%s\n%s",
		dimStyle.Render(label),
		valueStyle.Render(fmt.Sprintf("%d", value)),
	)
	return cardStyle.Render(body)
}

func renderEntityBlock(title string, rows []compare.Entity, limit int) {
	fmt.Println(title)
	if len(rows) == 0 {
		fmt.Println(dimStyle.Render("  (пусто)"))
		fmt.Println()
		return
	}
	for i, e := range rows {
		if i >= limit {
			fmt.Println(dimStyle.Render(fmt.Sprintf("  … ещё %d (полный список: --json)", len(rows)-limit)))
			break
		}
		label := e.Label
		if label == "" {
			label = "—"
		}
		fmt.Printf("  %s\n    %s\n",
			lipgloss.NewStyle().Bold(true).Render(truncate(label, 60)),
			iriStyle.Render(truncate(e.IRI, 100)),
		)
	}
	fmt.Println()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

func RenderError(msg string) {
	fmt.Fprintln(os.Stderr, badStyle.Render("✗ "+msg))
}

func BannerVersion(v string) {
	fmt.Println(titleStyle.Render(" asana-ontology-merge "))
	fmt.Println(subtitleStyle.Render("Go binary · CLI core · " + v))
	fmt.Println(dimStyle.Render(strings.TrimSpace(`
Ядро сравнения онтологий. HTTP API — Python-обёртка над этим бинарником.
`)))
}

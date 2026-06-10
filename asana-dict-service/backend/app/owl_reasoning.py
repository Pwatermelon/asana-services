"""
OWL 2 RL reasoning (W3C OWL 2 RL profile) для онтологии Asana.

Используется библиотека owlrl: стандартные правила вывода для
owl:TransitiveProperty и owl:SymmetricProperty (в т.ч. isSameAsObject).

Полный OWL DL reasoner (Pellet/HermiT) в runtime не подключён — для транзитивности
sameAs достаточен профиль OWL-RL, он соответствует семантике OWL.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from rdflib import Graph
from rdflib.namespace import OWL, RDF

if TYPE_CHECKING:
    pass

logger = logging.getLogger("asana_service.owl_reasoning")


def inject_is_same_as_owl_axioms(g: Graph, is_same_as_property) -> None:
    """TBox: isSameAsObject — объектное свойство, симметричное и транзитивное (как owl:sameAs)."""
    g.add((is_same_as_property, RDF.type, OWL.ObjectProperty))
    g.add((is_same_as_property, RDF.type, OWL.SymmetricProperty))
    g.add((is_same_as_property, RDF.type, OWL.TransitiveProperty))


def inject_not_same_as_owl_axioms(g: Graph, not_same_as_property) -> None:
    """TBox: notSameAsObject — симметричное, не транзитивное."""
    g.add((not_same_as_property, RDF.type, OWL.ObjectProperty))
    g.add((not_same_as_property, RDF.type, OWL.SymmetricProperty))


def apply_owl2_rl_inference(g: Graph) -> int:
    """
    Расширяет граф g выведенными триплетами по OWL 2 RL.
    Возвращает число добавленных триплетов.
    """
    from owlrl import DeductiveClosure, OWLRL_Semantics

    before = len(g)
    DeductiveClosure(OWLRL_Semantics).expand(g)
    added = len(g) - before
    if added:
        logger.debug("OWL 2 RL inference: +%s triple(s), total %s", added, len(g))
    return added


def is_same_as_owl_tbox_present(g: Graph, is_same_as_property) -> bool:
    """В графе уже есть OWL-аксиомы транзитивности/симметрии для isSameAsObject."""
    return (
        (is_same_as_property, RDF.type, OWL.TransitiveProperty) in g
        and (is_same_as_property, RDF.type, OWL.SymmetricProperty) in g
    )


def build_reasoned_graph(asserted: Graph, is_same_as_property) -> Graph:
    """
    Копия asserted-графа + аксиомы TBox + OWL 2 RL closure.
    Выведенные триплеты не пишутся в БД — только для запросов.
    """
    reasoned = Graph()
    for t in asserted:
        reasoned.add(t)
    inject_is_same_as_owl_axioms(reasoned, is_same_as_property)
    apply_owl2_rl_inference(reasoned)
    return reasoned

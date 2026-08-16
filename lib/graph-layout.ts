import type { GraphType, ModelGraph } from "@/lib/fga-model";

export type GraphTypeLayout = {
  column: number;
  height: number;
  type: GraphType;
  x: number;
  y: number;
};

function sortedValues(values: Iterable<string>) {
  return [...values].sort((first, second) => first.localeCompare(second));
}

export function focusedTypeIds(graph: ModelGraph, selectedRelationId: string | null) {
  if (!selectedRelationId) return new Set(graph.types.map((type) => type.id));

  const selectedRelation = graph.types
    .flatMap((type) => type.relations)
    .find((relation) => relation.id === selectedRelationId);
  if (!selectedRelation) return new Set(graph.types.map((type) => type.id));

  const related = new Set<string>([`type:${selectedRelation.type}`]);
  graph.dependencies.forEach((dependency) => {
    const targetsSelection = `${dependency.targetType}.${dependency.targetRelation}` === selectedRelationId;
    const originatesAtSelection = `${dependency.sourceType}.${dependency.sourceRelation ?? ""}` === selectedRelationId;
    if (!targetsSelection && !originatesAtSelection) return;
    related.add(`type:${dependency.sourceType}`);
    related.add(`type:${dependency.targetType}`);
  });
  return related;
}

export function computeGraphDepths(graph: ModelGraph, includedTypeIds?: Set<string>) {
  const names = sortedValues(graph.types
    .filter((type) => !includedTypeIds || includedTypeIds.has(type.id))
    .map((type) => type.name));
  const includedNames = new Set(names);
  const outgoing = new Map(names.map((name) => [name, new Set<string>()]));
  const incoming = new Map(names.map((name) => [name, new Set<string>()]));

  graph.dependencies.forEach((dependency) => {
    if (
      dependency.sourceType === dependency.targetType
      || !includedNames.has(dependency.sourceType)
      || !includedNames.has(dependency.targetType)
    ) return;
    outgoing.get(dependency.sourceType)?.add(dependency.targetType);
    incoming.get(dependency.targetType)?.add(dependency.sourceType);
  });

  const visited = new Set<string>();
  const order: string[] = [];
  const visit = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    sortedValues(outgoing.get(name) ?? []).forEach(visit);
    order.push(name);
  };
  names.forEach(visit);

  const assigned = new Set<string>();
  const components: string[][] = [];
  const collect = (name: string, component: string[]) => {
    if (assigned.has(name)) return;
    assigned.add(name);
    component.push(name);
    sortedValues(incoming.get(name) ?? []).forEach((source) => collect(source, component));
  };
  [...order].reverse().forEach((name) => {
    if (assigned.has(name)) return;
    const component: string[] = [];
    collect(name, component);
    components.push(component.sort((first, second) => first.localeCompare(second)));
  });

  components.sort((first, second) => first[0].localeCompare(second[0]));
  const componentByType = new Map<string, number>();
  components.forEach((component, index) => component.forEach((name) => componentByType.set(name, index)));
  const componentOutgoing = new Map(components.map((_, index) => [index, new Set<number>()]));
  const componentIncoming = new Map(components.map((_, index) => [index, 0]));

  outgoing.forEach((targets, source) => {
    const sourceComponent = componentByType.get(source)!;
    targets.forEach((target) => {
      const targetComponent = componentByType.get(target)!;
      const targetsForComponent = componentOutgoing.get(sourceComponent)!;
      if (sourceComponent === targetComponent || targetsForComponent.has(targetComponent)) return;
      targetsForComponent.add(targetComponent);
      componentIncoming.set(targetComponent, (componentIncoming.get(targetComponent) ?? 0) + 1);
    });
  });

  const componentDepth = new Map(components.map((_, index) => [index, 0]));
  const queue = components
    .map((_, index) => index)
    .filter((index) => componentIncoming.get(index) === 0)
    .sort((first, second) => components[first][0].localeCompare(components[second][0]));

  while (queue.length) {
    const source = queue.shift()!;
    [...(componentOutgoing.get(source) ?? [])]
      .sort((first, second) => components[first][0].localeCompare(components[second][0]))
      .forEach((target) => {
      componentDepth.set(target, Math.max(
        componentDepth.get(target) ?? 0,
        (componentDepth.get(source) ?? 0) + 1,
      ));
      componentIncoming.set(target, (componentIncoming.get(target) ?? 1) - 1);
      if (componentIncoming.get(target) === 0) {
        queue.push(target);
        queue.sort((first, second) => components[first][0].localeCompare(components[second][0]));
      }
      });
  }

  return new Map(names.map((name) => [name, componentDepth.get(componentByType.get(name)!) ?? 0]));
}

export function estimateTypeNodeHeight(type: GraphType, collapsed: boolean) {
  if (type.relations.length === 0) return 76;
  if (collapsed) return 92;
  return 68 + type.relations.length * 40;
}

export function layoutGraphTypes(
  graph: ModelGraph,
  collapsedTypes: Set<string>,
  includedTypeIds?: Set<string>,
) {
  const depths = computeGraphDepths(graph, includedTypeIds);
  const columns = new Map<number, GraphType[]>();
  graph.types
    .filter((type) => !includedTypeIds || includedTypeIds.has(type.id))
    .forEach((type) => {
      const column = depths.get(type.name) ?? 0;
      const types = columns.get(column) ?? [];
      types.push(type);
      columns.set(column, types);
    });

  const layouts: GraphTypeLayout[] = [];
  [...columns.entries()].sort(([first], [second]) => first - second).forEach(([column, types]) => {
    let y = 0;
    types.sort((first, second) => first.name.localeCompare(second.name)).forEach((type) => {
      const height = estimateTypeNodeHeight(type, collapsedTypes.has(type.id));
      layouts.push({ column, height, type, x: column * 350, y });
      y += height + 56;
    });
  });
  return layouts;
}

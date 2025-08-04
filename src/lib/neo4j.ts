import neo4j, {
  Integer,
  DateTime,
  Date as Neo4jDate,
  Time,
  Node,
  Record as Neo4jRecord,
} from "neo4j-driver";

// Create Neo4j driver instance
export const driver = neo4j.driver(
  process.env.NEO4J_URI || "bolt://localhost:7687",
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || "neo4j",
    process.env.NEO4J_PASSWORD || "password",
  ),
);

// Type for values that might be Neo4j types
type Neo4jValue =
  | Integer
  | DateTime
  | Neo4jDate
  | Time
  | string
  | number
  | boolean
  | null
  | undefined;

// Type for objects that might contain Neo4j types
type Neo4jCompatible =
  | Neo4jValue
  | Neo4jValue[]
  | Record<string, unknown>
  | Node;

// Convert Neo4j Integer to JavaScript number
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  // Neo4j Integer object with low/high properties
  if (
    typeof value === "object" &&
    value !== null &&
    "low" in value &&
    "high" in value
  ) {
    return neo4j.int(value as { low: number; high: number }).toNumber();
  }

  // Neo4j Integer instance
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }

  // Regular number
  if (typeof value === "number") {
    return value;
  }

  // String that can be converted to number
  if (typeof value === "string" && !isNaN(Number(value))) {
    return Number(value);
  }

  return 0;
}

// Convert Neo4j Date/DateTime to JavaScript Date
export function toDate(value: unknown): Date | null {
  if (!value) return null;

  // Neo4j DateTime/Date object
  if (
    value &&
    typeof value === "object" &&
    "toString" in value &&
    typeof (value as { toString: () => string }).toString === "function"
  ) {
    return new Date((value as { toString: () => string }).toString());
  }

  // ISO string
  if (typeof value === "string") {
    return new Date(value);
  }

  return null;
}

// Recursively convert Neo4j types in an object
export function convertNeo4jTypes(obj: Neo4jCompatible): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Array
  if (Array.isArray(obj)) {
    return obj.map(convertNeo4jTypes);
  }

  // Object
  if (typeof obj === "object") {
    // Neo4j Integer
    if ("low" in obj && "high" in obj) {
      return toNumber(obj);
    }

    // Neo4j Date/DateTime
    if (
      obj.constructor &&
      (obj.constructor.name === "DateTime" ||
        obj.constructor.name === "Date" ||
        obj.constructor.name === "Time")
    ) {
      return toDate(obj);
    }

    // Regular object - convert all properties
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      converted[key] = convertNeo4jTypes(value as Neo4jCompatible);
    }
    return converted;
  }

  return obj;
}

// Convert Neo4j record properties
export function convertRecord(record: Neo4jRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  record.keys.forEach((key: PropertyKey) => {
    const keyString = String(key);
    const value = record.get(keyString);

    // Handle Neo4j Node
    if (
      value &&
      typeof value === "object" &&
      value !== null &&
      "properties" in value
    ) {
      result[keyString] = convertNeo4jTypes(
        (value as Node).properties as Neo4jCompatible,
      );
    } else {
      result[keyString] = convertNeo4jTypes(value as Neo4jCompatible);
    }
  });

  return result;
}

// Convert array of Neo4j records
export function convertRecords(
  records: Neo4jRecord[],
): Record<string, unknown>[] {
  return records.map(convertRecord);
}

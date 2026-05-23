import type * as vscode from "vscode";

const EXTENSION_ID = "tombi";
const CONFIG_KEY = "config";

export interface Settings {
  path?: string;
  args?: string[];
  env?: Record<string, string>;
  config?: Record<string, unknown>;
}

type ConfigurationLike = Pick<vscode.WorkspaceConfiguration, "get" | "inspect">;

type ExtensionPackageJson = {
  contributes?: {
    configuration?: {
      properties?: Record<string, unknown>;
    };
  };
};

export function readSettings(
  configuration: ConfigurationLike,
  packageJson: ExtensionPackageJson,
): Settings {
  const settings: Settings = {};

  const path = configuration.get<string | null>("path");
  if (path != null) {
    settings.path = path;
  }

  const args = configuration.get<string[] | null>("args");
  if (args != null) {
    settings.args = args;
  }

  const env = configuration.get<Record<string, string> | null>("env");
  if (env != null) {
    settings.env = env;
  }

  const config = buildEditorConfigPayload(
    configuration,
    getEditorConfigPropertyKeys(packageJson),
  );
  if (config !== undefined) {
    settings.config = config;
  }

  return settings;
}

export function getEditorConfigPropertyKeys(
  packageJson: ExtensionPackageJson,
): string[] {
  const properties = packageJson.contributes?.configuration?.properties ?? {};

  return Object.keys(properties)
    .filter((key) => key.startsWith(`${EXTENSION_ID}.${CONFIG_KEY}.`))
    .map((key) => key.slice(`${EXTENSION_ID}.`.length));
}

export function buildEditorConfigPayload(
  configuration: ConfigurationLike,
  configPropertyKeys: readonly string[],
): Record<string, unknown> | undefined {
  const topLevelConfig = getExplicitValue<Record<string, unknown> | null>(
    configuration,
    CONFIG_KEY,
  );
  const config = isRecord(topLevelConfig) ? { ...topLevelConfig } : {};

  for (const key of configPropertyKeys) {
    const value = getExplicitValue(configuration, key);
    if (value === undefined) {
      continue;
    }
    const segments = key.slice(`${CONFIG_KEY}.`.length).split(".");
    setNestedValue(config, segments, value);
  }

  return Object.keys(config).length > 0 ? config : undefined;
}

type ConfigurationInspection<T> = {
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
  globalLanguageValue?: T;
  workspaceLanguageValue?: T;
  workspaceFolderLanguageValue?: T;
};

function getExplicitValue<T>(
  configuration: ConfigurationLike,
  section: string,
): T | undefined {
  const inspected = configuration.inspect<T>(section);
  if (!inspected) {
    return undefined;
  }

  return highestPriorityExplicitValue(inspected);
}

function highestPriorityExplicitValue<T>(
  inspected: ConfigurationInspection<T>,
): T | undefined {
  const explicitValues = [
    inspected.workspaceFolderLanguageValue,
    inspected.workspaceLanguageValue,
    inspected.globalLanguageValue,
    inspected.workspaceFolderValue,
    inspected.workspaceValue,
    inspected.globalValue,
  ];

  return explicitValues.find((value) => value !== undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setNestedValue(
  target: Record<string, unknown>,
  segments: string[],
  value: unknown,
): void {
  let current: Record<string, unknown> = target;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (typeof next === "object" && next !== null && !Array.isArray(next)) {
      current = next as Record<string, unknown>;
    } else {
      const created: Record<string, unknown> = {};
      current[segment] = created;
      current = created;
    }
  }

  const leaf = segments[segments.length - 1];
  if (leaf) {
    current[leaf] = value;
  }
}

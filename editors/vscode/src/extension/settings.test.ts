import { describe, expect, it } from "vitest";
import {
  buildEditorConfigPayload,
  getEditorConfigPropertyKeys,
  readSettings,
} from "./settings";

type Inspection<T> = {
  key: string;
  defaultValue?: T;
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
  defaultLanguageValue?: T;
  globalLanguageValue?: T;
  workspaceLanguageValue?: T;
  workspaceFolderLanguageValue?: T;
  languageIds?: string[];
};

type ConfigurationStub = {
  get<T>(section: string): T | undefined;
  inspect<T>(section: string): Inspection<T> | undefined;
};

function createConfigurationStub(
  values: Record<string, unknown>,
  inspections: Record<string, Omit<Inspection<unknown>, "key">> = {},
): ConfigurationStub {
  return {
    get<T>(section: string): T | undefined {
      return values[section] as T | undefined;
    },
    inspect<T>(section: string): Inspection<T> | undefined {
      const inspection = inspections[section];
      if (!inspection) {
        return undefined;
      }
      return {
        key: section,
        ...inspection,
      } as Inspection<T>;
    },
  };
}

const packageJson = {
  contributes: {
    configuration: {
      properties: {
        "tombi.path": {},
        "tombi.args": {},
        "tombi.env": {},
        "tombi.config.files.include": {},
        "tombi.config.format.rules.array-bracket-space-width": {},
        "tombi.config.format.rules.array-comma-space-width": {},
      },
    },
  },
};

describe("getEditorConfigPropertyKeys", () => {
  it("collects only editor config keys", () => {
    expect(getEditorConfigPropertyKeys(packageJson)).toEqual([
      "config.files.include",
      "config.format.rules.array-bracket-space-width",
      "config.format.rules.array-comma-space-width",
    ]);
  });
});

describe("buildEditorConfigPayload", () => {
  it("merges legacy object config with explicit dotted keys", () => {
    const configuration = createConfigurationStub(
      {},
      {
        config: {
          workspaceValue: {
            format: {
              rules: {
                "array-comma-space-width": 3,
              },
            },
          },
        },
        "config.files.include": {
          workspaceValue: ["**/*.toml"],
        },
        "config.format.rules.array-bracket-space-width": {
          workspaceValue: 0,
        },
        "config.format.rules.array-comma-space-width": {
          workspaceValue: 1,
        },
      },
    );

    expect(
      buildEditorConfigPayload(
        configuration,
        getEditorConfigPropertyKeys(packageJson),
      ),
    ).toEqual({
      files: {
        include: ["**/*.toml"],
      },
      format: {
        rules: {
          "array-bracket-space-width": 0,
          "array-comma-space-width": 1,
        },
      },
    });
  });

  it("ignores schema defaults when no explicit config values are set", () => {
    const configuration = createConfigurationStub(
      {
        "config.files.include": ["**/*.toml"],
        "config.format.rules.array-bracket-space-width": 0,
        "config.format.rules.array-comma-space-width": 1,
      },
      {
        "config.files.include": {},
        "config.format.rules.array-bracket-space-width": {},
        "config.format.rules.array-comma-space-width": {},
      },
    );

    expect(
      buildEditorConfigPayload(
        configuration,
        getEditorConfigPropertyKeys(packageJson),
      ),
    ).toBeUndefined();
  });
});

describe("readSettings", () => {
  it("reads top-level settings and only forwards explicit editor config", () => {
    const configuration = createConfigurationStub(
      {
        path: "/tmp/tombi",
        args: ["serve"],
        env: { FOO: "bar" },
        "config.files.include": ["**/*.toml"],
        "config.format.rules.array-bracket-space-width": 0,
        "config.format.rules.array-comma-space-width": 1,
      },
      {
        "config.files.include": {
          workspaceValue: ["**/*.toml"],
        },
        "config.format.rules.array-bracket-space-width": {},
        "config.format.rules.array-comma-space-width": {
          workspaceValue: 1,
        },
      },
    );

    expect(readSettings(configuration, packageJson)).toEqual({
      path: "/tmp/tombi",
      args: ["serve"],
      env: { FOO: "bar" },
      config: {
        files: {
          include: ["**/*.toml"],
        },
        format: {
          rules: {
            "array-comma-space-width": 1,
          },
        },
      },
    });
  });
});

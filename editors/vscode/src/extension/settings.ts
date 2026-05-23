export interface Settings {
  path?: string;
  args?: string[];
  env?: Record<string, string>;
  config?: Record<string, unknown>;
}

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import YAML from "yaml";
import { describe, expect, it } from "vitest";

describe("detector OpenAPI", () => {
  const specPath = resolve(process.cwd(), "..", "api-spec", "openapi.yaml");

  it("is structurally valid", async () => {
    await expect(SwaggerParser.validate(specPath)).resolves.toBeTruthy();
  });

  it("matches live health and readiness responses inside the sandbox", async () => {
    const document = YAML.parse(await readFile(specPath, "utf8"));
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    for (const [path, schemaName] of [["/health", "Health"], ["/ready", "Readiness"]] as const) {
      const response = await fetch(`http://127.0.0.1:8080${path}`);
      expect([200, 503]).toContain(response.status);
      const validate = ajv.compile(document.components.schemas[schemaName]);
      expect(validate(await response.json()), JSON.stringify(validate.errors)).toBe(true);
    }
  });
});

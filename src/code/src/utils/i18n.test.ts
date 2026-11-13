import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import i18n, { t, locale, categoryLabel } from "../i18n";
import english from "../locales/en.json";
import { formatItemDate } from "./itemDate";
test("all literal translation calls exist in both locale resources", () => {
  const files = [
    "src/App.tsx",
    "src/i18n.tsx",
    ...readdirSync("src/components")
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => "src/components/" + name),
  ];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "t" &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        assert.ok(
          Object.hasOwn(english, node.arguments[0].text),
          `${file}: ${node.arguments[0].text}`,
        );
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.ok(Object.values(english).every((value) => value.length > 0));
});
test("system templates translate while interpolated user text and enums are preserved", async () => {
  try {
    await i18n.changeLanguage("en");
    assert.equal(locale(), "en-US");
    assert.equal(categoryLabel("Home"),"Home");
    assert.equal(t("Misma categoría: Llaves"), "Same category: Keys");
    assert.equal(t("El título es obligatorio."), "The title is required.");
    assert.equal(
      t("Eliminar {{title}}", { title: "Llaves de María" }),
      "Delete Llaves de María",
    );
    assert.equal(
      t("Texto propio sin traducción"),
      "Texto propio sin traducción",
    );
    assert.equal(t("Publicar objeto"), "Post an item");
    assert.notEqual(formatItemDate("2026-11-04"), "Fecha no disponible");
  } finally {
    await i18n.changeLanguage("es");
  }
  assert.equal(t("Perfil"), "Perfil");
  assert.equal(t("perdido"), "perdido");
});

import { describe, expect, it } from "vitest";
import { createParty, deleteParty, getParty, listParties, migrateOldSave, partyKey, partyStore } from "../../src/saves.js";
import { memoryStorage } from "./helpers.js";

describe("parties", () => {
  it("crée, retrouve et supprime une partie avec ses données", () => {
    const storage = memoryStorage();
    const party = createParty("Les Sans-Voix", "img/chef1.png", storage);
    partyStore(party.id, storage).set("counter", 42);

    expect(getParty(party.id, storage)).toMatchObject({ parti: "Les Sans-Voix", chef: "img/chef1.png" });
    expect(storage.getItem(partyKey(party.id, "counter"))).toBe("42");

    deleteParty(party.id, storage);
    expect(listParties(storage)).toEqual([]);
    expect(storage.getItem(partyKey(party.id, "counter"))).toBeNull();
  });

  it("les données de deux parties ne se mélangent pas", () => {
    const storage = memoryStorage();
    const a = { id: "a" };
    const b = { id: "b" };
    partyStore(a.id, storage).set("counter", 1);
    partyStore(b.id, storage).set("counter", 2);
    expect(partyStore(a.id, storage).get("counter")).toBe("1");
    expect(partyStore(b.id, storage).get("counter")).toBe("2");
  });

  it("récupère l'ancienne sauvegarde unique comme première partie", () => {
    const storage = memoryStorage();
    storage.setItem("parti", "Ancien Parti");
    storage.setItem("chef-image", "img/chef2.png");
    storage.setItem("counter", "42");

    migrateOldSave(storage);
    const [party] = listParties(storage);
    expect(party).toMatchObject({ parti: "Ancien Parti", chef: "img/chef2.png" });
    expect(partyStore(party.id, storage).get("counter")).toBe("42");
    expect(storage.getItem("counter")).toBeNull();

    // a second call does nothing
    migrateOldSave(storage);
    expect(listParties(storage)).toHaveLength(1);
  });

  it("un localStorage abîmé donne une liste vide", () => {
    const storage = memoryStorage();
    storage.setItem("parties", "pas du json");
    expect(listParties(storage)).toEqual([]);
  });
});

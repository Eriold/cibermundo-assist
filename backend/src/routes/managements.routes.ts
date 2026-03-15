import { createNamedCatalogRouter } from "./catalog-route-factory.js";

export default createNamedCatalogRouter({
  tableName: "managements",
  nameRequiredMessage: "name is required",
  emptyNameMessage: "name cannot be empty",
  conflictMessage: "Esta gestion ya existe",
  createdMessage: "Gestion creada",
  updatedMessage: "Gestion actualizada",
  deletedMessage: "Gestion eliminada",
  invalidDataMessage: "Invalid data",
  invalidIdMessage: "Invalid ID format",
  notFoundMessage: "Not found",
});

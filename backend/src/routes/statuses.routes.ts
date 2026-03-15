import { createNamedCatalogRouter } from "./catalog-route-factory.js";

export default createNamedCatalogRouter({
  tableName: "statuses",
  nameRequiredMessage: "name is required",
  emptyNameMessage: "name cannot be empty",
  conflictMessage: "Ese estado ya existe",
  createdMessage: "Estado creado",
  updatedMessage: "Estado actualizado",
  deletedMessage: "Estado eliminado",
  invalidDataMessage: "Invalid data",
  invalidIdMessage: "Invalid ID format",
  notFoundMessage: "Not found",
});

import type { Book, BookModel } from "./types.ts";

export const fromModelToBook = (model: BookModel): Book => ({
  id: model._id!.toString(),
  tittle: model.tittle,
  author: model.author,
  year: model.year,
});
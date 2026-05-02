"use server";

import { ItemWithOptions } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections, MongoMenuCategory, MongoMenuItem } from "@/lib/mongodb/collections";

export const getAllMenuItems = async (categoryName?: string, onlyAvailable: boolean = false): Promise<ItemWithOptions[]> => {
  const mongoDb = await getMongoDb();
  const categories = await mongoDb.collection<MongoMenuCategory>(mongoCollections.menuCategories).find().toArray();
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const selectedCategory = categoryName
    ? categories.find((category) => category.name.toLowerCase() === categoryName.toLowerCase())
    : undefined;

  const filter: Record<string, unknown> = { is_deleted: false };
  if (selectedCategory) filter.category_id = selectedCategory.id;
  if (categoryName && !selectedCategory) filter.category_id = -1;
  if (onlyAvailable) filter.is_available = true;

  const items = await mongoDb
    .collection<MongoMenuItem>(mongoCollections.menuItems)
    .find(filter)
    .sort({ id: 1 })
    .toArray();

  return items.map((item) => {
    const category = categoryById.get(Number(item.category_id));

    return {
      id: item.id,
      image: item.image ?? null,
      item: item.name,
      description: item.description ?? "",
      price: Number(item.price),
      is_available: item.is_available ?? false,
      category: category?.name ?? "Others",
      category_id: item.category_id ? String(item.category_id) : "others",
      options: (item.options ?? []).map((option) => ({
        option_id: option.id,
        option_name: option.option_name ?? "",
        price: option.price,
      })),
    };
  });
};

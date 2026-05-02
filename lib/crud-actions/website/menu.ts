"use server";
import { ItemWithOptions, MenuResponse } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections, MongoMenuCategory, MongoMenuItem } from "@/lib/mongodb/collections";



/**
 * === Get All Website Menu Items (Paginated) ===
 *
 * Fetches menu items with optional filtering by search term, category, and availability.
 * Returns paginated results, joined categories, and mapped item options.
 *
 * @param searchTerm - Text to filter menu item names.
 * @param pageNumber - Page number for pagination (default: 1).
 * @param pageSize - Number of items per page (default: 16).
 * @param category - Optional category filter.
 * @param availability - Optional availability filter.
 * @returns {Promise<MenuResponse>} Paginated list of menu items with options.
 */
export const getAllMenuItemsForWebsite = async (
    searchTerm: string = "",
    pageNumber: number = 1,
    pageSize: number = 16,
    category?: string,
    availability?: boolean
): Promise<MenuResponse> => {
    const skip = (pageNumber - 1) * pageSize;
    const mongoDb = await getMongoDb();

    const categories = await mongoDb
        .collection<MongoMenuCategory>(mongoCollections.menuCategories)
        .find()
        .toArray();

    const categoryById = new Map(categories.map((item) => [item.id, item]));
    const categoryFilter = category
        ? categories.find((item) => item.name.toLowerCase() === category.toLowerCase())
        : undefined;

    const filters: Record<string, unknown> = { is_deleted: false };

    if (category) {
        filters.category_id = categoryFilter?.id ?? -1;
    }

    if (availability !== undefined) {
        filters.is_available = availability;
    }

    if (searchTerm) {
        filters.name = { $regex: searchTerm, $options: "i" };
    }

    const itemsCollection = mongoDb.collection<MongoMenuItem>(mongoCollections.menuItems);
    const totalRecords = await itemsCollection.countDocuments(filters);
    const totalPages = Math.ceil(totalRecords / pageSize);

    const menuItemsRows = await itemsCollection
        .find(filters)
        .sort({ id: 1 })
        .skip(skip)
        .limit(pageSize)
        .toArray();

    const menuItems: ItemWithOptions[] = menuItemsRows.map((item) => {
        const mappedCategory = categoryById.get(item.category_id);

        return {
            id: item.id,
            image: item.image ?? null,
            item: item.name,
            description: item.description ?? "",
            price: Number(item.price),
            is_available: item.is_available,
            category: mappedCategory?.name ?? "Others",
            category_id: item.category_id ? item.category_id.toString() : "others",
            options: item.options.map((option) => ({
                option_id: option.id,
                option_name: option.option_name ?? "",
                price: option.price,
            })),
        };
    });

    return {
        query: searchTerm || null,
        totalRecords,
        page: pageNumber,
        totalPages,
        pageSize,
        menuItems,
    };
};

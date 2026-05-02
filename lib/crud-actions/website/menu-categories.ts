import { MenuCategoryWithItemCount } from "@/lib/definations";
import { mongoCollections, MongoMenuCategory, MongoMenuItem } from "@/lib/mongodb/collections";
import { getMongoDb } from "@/lib/mongodb";



/**
 * === Fetch Menu Categories with Item Counts ===
 *
 * Retrieves all menu categories with the total number of active (non-deleted)
 * items in each category.
 * 
 * @returns {Promise<MenuCategoryWithItemCount[]>} A list of menu categories with item count.
 */
export const getMenuCategoryWithItemCount = async (): Promise<MenuCategoryWithItemCount[]> => {
    const mongoDb = await getMongoDb();
    const categories = await mongoDb
        .collection<MongoMenuCategory>(mongoCollections.menuCategories)
        .find()
        .sort({ id: 1 })
        .toArray();

    const items = await mongoDb
        .collection<MongoMenuItem>(mongoCollections.menuItems)
        .find({ is_deleted: false }, { projection: { category_id: 1 } })
        .toArray();

    const itemCounts = new Map<number, number>();
    for (const item of items) {
        itemCounts.set(item.category_id, (itemCounts.get(item.category_id) ?? 0) + 1);
    }

    return categories.map((category) => ({
        id: category.id,
        category: category.name,
        description: category.description,
        total_items: itemCounts.get(category.id) ?? 0,
    }));
};

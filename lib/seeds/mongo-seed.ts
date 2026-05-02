import dotenv from "dotenv";
import type { MongoClient } from "mongodb";
import { getMongoDb, mongoClientPromise } from "@/lib/mongodb";
import { mongoCollections, MongoMenuCategory, MongoMenuItem } from "@/lib/mongodb/collections";
import { navLink } from "../../constants";

dotenv.config({ path: ".env.local" });

const categories: MongoMenuCategory[] = [
  { id: 1, name: "Burgers", description: "Stacked classics and house favorites" },
  { id: 2, name: "Pizzas", description: "Fresh baked pizzas with simple toppings" },
  { id: 3, name: "Drinks", description: "Cold drinks and refreshers" },
];

const menuItems: MongoMenuItem[] = [
  {
    id: 1,
    image: "/images/placeholder-image.jpg",
    category_id: 1,
    name: "Classic Beef Burger",
    description: "Beef patty, cheese, lettuce, tomato, and house sauce.",
    price: "8.99",
    is_available: true,
    is_deleted: false,
    options: [
      { id: 1, option_name: "Single", price: "8.99" },
      { id: 2, option_name: "Double", price: "11.99" },
    ],
  },
  {
    id: 2,
    image: "/images/placeholder-image.jpg",
    category_id: 2,
    name: "Margherita Pizza",
    description: "Tomato, mozzarella, basil, and olive oil.",
    price: "12.50",
    is_available: true,
    is_deleted: false,
    options: [
      { id: 3, option_name: "Medium", price: "12.50" },
      { id: 4, option_name: "Large", price: "16.50" },
    ],
  },
  {
    id: 3,
    image: "/images/placeholder-image.jpg",
    category_id: 3,
    name: "Fresh Lemonade",
    description: "Lemon, mint, sugar, and sparkling water.",
    price: "3.25",
    is_available: true,
    is_deleted: false,
    options: [],
  },
];

const modules = navLink.flatMap((item) => {
  if (!("items" in item) || !Array.isArray(item.items)) return [];
  return item.items.map((subItem, index) => ({
    id: index + 1,
    name: subItem.url.replace(/^\/restaurant\//, ""),
    label: subItem.title,
  }));
}).map((item, index) => ({ ...item, id: index + 1 }));

const role = { id: 1, role: "admin" };
const admin = {
  id: 1,
  image: null,
  name: "Admin",
  email: "admin@example.com",
  password: "123456",
  is_active: true,
  role_id: 1,
  created_at: new Date(),
};

const permissions = modules.map((module, index) => ({
  id: index + 1,
  role_id: 1,
  module_id: module.id,
  label: `Full access to ${module.label}`,
  can_view: true,
  can_edit: true,
  can_create: true,
  can_delete: false,
}));

const transactionCategories = [
  { id: 1, category: "salary", description: "Monthly salary payments to employees", locked: true },
  { id: 2, category: "invoice", description: "Transactions generated from customer invoices", locked: true },
  { id: 3, category: "others", description: "Miscellaneous or uncategorized payments", locked: true },
];

async function main() {
  const mongoDb = await getMongoDb();

  await Promise.all([
    mongoDb.collection(mongoCollections.roles).deleteMany({}),
    mongoDb.collection(mongoCollections.users).deleteMany({}),
    mongoDb.collection(mongoCollections.modules).deleteMany({}),
    mongoDb.collection(mongoCollections.permissions).deleteMany({}),
    mongoDb.collection(mongoCollections.transactionCategoriesTable).deleteMany({}),
    mongoDb.collection<MongoMenuCategory>(mongoCollections.menuCategories).deleteMany({}),
    mongoDb.collection<MongoMenuItem>(mongoCollections.menuItems).deleteMany({}),
    mongoDb.collection("_counters").deleteMany({}),
  ]);

  await Promise.all([
    mongoDb.collection(mongoCollections.roles).insertOne(role),
    mongoDb.collection(mongoCollections.users).insertOne(admin),
    mongoDb.collection(mongoCollections.modules).insertMany(modules),
    mongoDb.collection(mongoCollections.permissions).insertMany(permissions),
    mongoDb.collection(mongoCollections.transactionCategoriesTable).insertMany(transactionCategories),
    mongoDb.collection<MongoMenuCategory>(mongoCollections.menuCategories).insertMany(categories),
    mongoDb.collection<MongoMenuItem>(mongoCollections.menuItems).insertMany(menuItems),
  ]);

  await mongoDb.collection(mongoCollections.roles).createIndex({ id: 1 }, { unique: true });
  await mongoDb.collection(mongoCollections.users).createIndex({ id: 1 }, { unique: true });
  await mongoDb.collection(mongoCollections.users).createIndex({ email: 1 }, { unique: true });
  await mongoDb.collection(mongoCollections.modules).createIndex({ id: 1 }, { unique: true });
  await mongoDb.collection(mongoCollections.permissions).createIndex({ id: 1 }, { unique: true });
  await mongoDb.collection(mongoCollections.transactionCategoriesTable).createIndex({ id: 1 }, { unique: true });
  await mongoDb.collection<MongoMenuCategory>(mongoCollections.menuCategories).createIndex({ id: 1 }, { unique: true });
  await mongoDb.collection<MongoMenuItem>(mongoCollections.menuItems).createIndex({ id: 1 }, { unique: true });
  await mongoDb.collection<MongoMenuItem>(mongoCollections.menuItems).createIndex({ name: "text" });

  await mongoDb.collection<{ _id: string; seq: number }>("_counters").insertMany([
    { _id: mongoCollections.roles, seq: role.id },
    { _id: mongoCollections.users, seq: admin.id },
    { _id: mongoCollections.modules, seq: modules.length },
    { _id: mongoCollections.permissions, seq: permissions.length },
    { _id: mongoCollections.transactionCategoriesTable, seq: transactionCategories.length },
    { _id: mongoCollections.menuCategories, seq: categories.length },
    { _id: mongoCollections.menuItems, seq: menuItems.length },
  ]);

  console.log("MongoDB menu seed complete.");
}

let client: MongoClient | null = null;

main()
  .catch((error) => {
    console.error("MongoDB seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      client = await mongoClientPromise;
      await client.close();
    } catch {
      // Connection errors are already reported by main().
    }
  });

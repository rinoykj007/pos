export interface MongoMenuCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface MongoMenuItemOption {
  id: number;
  option_name: string;
  price: string;
}

export interface MongoMenuItem {
  id: number;
  image: string | null;
  category_id: number;
  name: string;
  description: string | null;
  price: string;
  is_available: boolean;
  is_deleted: boolean;
  options: MongoMenuItemOption[];
}

export const mongoCollections = {
  roles: "roles",
  modules: "modules",
  users: "users",
  permissions: "permissions",
  menuCategories: "menu_categories",
  menuItems: "menu_items",
  menuItemOptions: "menu_item_options",
  restaurantTables: "restaurant_tables",
  bookingsTables: "bookings_tables",
  ordersTable: "orders_table",
  orderItemsTable: "order_items_table",
  InvoicesTable: "invoices_table",
  employeesTable: "employees",
  employmentRecordsTable: "employment_records",
  salaryChangesTable: "salary_changes",
  payrollsTable: "payrolls",
  transactionCategoriesTable: "transaction_categories",
  transactionsTable: "transactions",
} as const;

export type MongoCollectionKey = keyof typeof mongoCollections;

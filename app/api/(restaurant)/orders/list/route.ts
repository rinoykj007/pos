import { auth } from "@/auth";
import { getMongoDb } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

const path = '/api/orders/list';

/**
 * [GET] Fetch all orders with items for order management
 * Includes all order statuses for viewing and pending/in-progress for editing
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const mongoDb = await getMongoDb();

    // Fetch all orders with their items and related table data
    const orders = await mongoDb
      .collection('orders_table')
      .aggregate([
        {
          $lookup: {
            from: 'order_items_table',
            localField: '_id',
            foreignField: 'orderId',
            as: 'items'
          }
        },
        {
          $lookup: {
            from: 'restaurant_tables',
            let: { tableId: { $toInt: '$tableId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$id', '$$tableId'] } } }
            ],
            as: 'table'
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $project: {
            _id: 0,
            id: '$_id',
            tableId: 1,
            orderType: 1,
            status: 1,
            description: 1,
            createdAt: 1,
            items: 1,
            table: { $arrayElemAt: ['$table', 0] }
          }
        }
      ])
      .toArray();

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error(`[GET ${path}] Failed to fetch orders list:`, error);
    return NextResponse.json(
      { error: "Something went wrong while retrieving orders." },
      { status: 500 }
    );
  }
}

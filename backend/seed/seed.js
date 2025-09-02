// backend/seed/seed.js  (ESM)
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import Customer from '../models/Customer.js';
import Service from '../models/Service.js';
import User from '../models/User.js';
import Staff from '../models/Staff.js';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import { nextInvoiceNumber } from '../utils/invoiceNumber.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // امسح أي بيانات قديمة
    await Promise.all([
      User.deleteMany({}),
      Customer.deleteMany({}),
      Service.deleteMany({}),
      Staff.deleteMany({}),
      Appointment.deleteMany({}),
      Invoice.deleteMany({}),
      Expense.deleteMany({})
    ]);

    // مدير افتراضي (مع هاش الباسورد)
    const manager = await User.create({
      name: 'Manager',
      email: 'manager@spa.com',
      role: 'manager',
      passwordHash: await bcrypt.hash('manager123', 10)
    });

    const staff1 = await Staff.create({ name: 'Ava', specialties: ['Massage','Facial'] });
    const staff2 = await Staff.create({ name: 'Noah', specialties: ['Massage','Hot Stone'] });

    // إضافة خدمات بعامل "duration" وليس duration
const svcs = await Service.insertMany([
  { name: "Swedish Massage", duration: 60, price: 80, category: "Massage" },
  { name: "Deep Tissue Massage", duration: 60, price: 95, category: "Massage" },
  { name: "Facial Treatment", duration: 45, price: 70, category: "Facial" }
]);

    const custs = await Customer.insertMany([
      { name: 'Alice Brown', email: 'alice@mail.com', phone: '111-111' },
      { name: 'Ben Clark', email: 'ben@mail.com', phone: '222-222' },
      { name: 'Cara Diaz', email: 'cara@mail.com', phone: '333-333' }
    ]);

    // موعد مكتمل + فاتورة تجريبية
    const now = new Date();
    const appt1 = await Appointment.create({
      customer: custs[0]._id, staff: staff1._id, service: svcs[0]._id,
      startAt: new Date(now.getTime()-86400000*10),
      endAt: new Date(now.getTime()-86400000*10 + 60*60000),
      status: 'completed', rating: 5
    });

    const invNum = nextInvoiceNumber(null);
    await Invoice.create({
      number: invNum,
      customer: custs[0]._id,
      appointment: appt1._id,
      items: [{
        service: svcs[0]._id,
        description: svcs[0].name,
        qty: 1,
        unitPrice: svcs[0].price,
        total: svcs[0].price
      }],
      subTotal: svcs[0].price,
      discount: 0,
      taxRate: 0.05,
      tax: svcs[0].price * 0.05,
      grandTotal: svcs[0].price * 1.05,
      paidBy: 'card'
    });

    await Expense.insertMany([
      { category: 'Rent', amount: 1500, occurredAt: new Date(now.getFullYear(), now.getMonth()-1, 5) },
      { category: 'Supplies', amount: 220, occurredAt: new Date(now.getFullYear(), now.getMonth(), 2) },
      { category: 'Salaries', amount: 3000, occurredAt: new Date(now.getFullYear(), now.getMonth(), 1) }
    ]);

    console.log('✅ Seeded. Login with: manager@spa.com / manager123');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
  }
}

run();

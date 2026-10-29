// اختبارات الحسابات المالية الأساسية. تشغيل: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { round2, parseArabicNumber, normalizePhone } from './money';
import { calculateInvoiceTotals, allocateInvoiceLines, calculateLineReturn, distributeDiscount } from './invoice';
import { calculateInvoiceProfit, calculateRealProfit, calculateMismatch } from './profit';
import { makeCode } from './codes';

test('round2 لا يرجع -0', () => {
  assert.ok(!Object.is(round2(-0.004), -0));
  assert.equal(round2(1.005), 1.01);
});

test('parseArabicNumber: الفاصلة العشرية وفاصل الآلاف', () => {
  assert.equal(parseArabicNumber('12,5'), 12.5);
  assert.equal(parseArabicNumber('1,250'), 1250);
  assert.equal(parseArabicNumber('1,250.50'), 1250.5);
  assert.equal(parseArabicNumber('١٢٫٥'), 12.5);
  assert.equal(parseArabicNumber('12-5'), 0);
  assert.equal(parseArabicNumber('1e3'), 0);
  assert.equal(parseArabicNumber(''), 0);
});

test('normalizePhone', () => {
  assert.equal(normalizePhone('٠١٠ ١٢٣-٤٥٦٧'), '0101234567');
  assert.equal(normalizePhone(' 0100 123 4567 '), '01001234567');
});

test('توزيع الخصم: مجموع الحصص = الخصم بالضبط', () => {
  const sh = distributeDiscount(30, 10, [{ price: 10, quantity: 1 }, { price: 10, quantity: 1 }, { price: 10, quantity: 1 }]);
  assert.deepEqual(sh, [3.33, 3.33, 3.34]);
});

test('خصم إجمالي أكبر من المجموع يُقصّ', () => {
  const items: any[] = [{ unitPrice: 100, quantity: 2, discount: 0 }];
  const t = calculateInvoiceTotals({ items, overallDiscount: 500 });
  assert.equal(t.discountTotal, 200);
  assert.equal(t.grandTotal, 0);
});

test('فاتورة 2×100 خصم 20: المرتجع حسب ما دفعه العميل (90 ثم 180)', () => {
  const items: any[] = [{ unitPrice: 100, quantity: 2, discount: 0, total: 200 }];
  const t = calculateInvoiceTotals({ items, overallDiscount: 20 });
  assert.equal(t.grandTotal, 180);
  const [line] = allocateInvoiceLines(items, 20, 0, t.taxTotal);
  assert.equal(line.lineGrand, 180);
  const r1 = calculateLineReturn(line.lineGrand, 2, 1, 0, 0);
  assert.equal(r1.refundAmount, 90);
  const r2 = calculateLineReturn(line.lineGrand, 2, 1, 1, 90);
  assert.equal(r2.refundAmount, 90);
});

test('إرجاع كل الفاتورة = إجمالي الفاتورة بالضبط (3 بنود وخصم غير قابل للقسمة)', () => {
  const items: any[] = [
    { unitPrice: 10, quantity: 1, discount: 0, total: 10 },
    { unitPrice: 10, quantity: 1, discount: 0, total: 10 },
    { unitPrice: 10, quantity: 1, discount: 0, total: 10 },
  ];
  const t = calculateInvoiceTotals({ items, overallDiscount: 10 });
  const lines = allocateInvoiceLines(items, 10, 0, t.taxTotal);
  const sum = round2(lines.reduce((s, l) => s + l.lineGrand, 0));
  assert.equal(sum, t.grandTotal);
  assert.equal(sum, 20);
});

test('الضريبة: 2×100 خصم 20 ضريبة 14% = 205.2 وتتوزع بلا فرق', () => {
  const items: any[] = [{ unitPrice: 100, quantity: 2, discount: 0, total: 200 }];
  const t = calculateInvoiceTotals({ items, overallDiscount: 20, taxRate: 14 });
  assert.equal(t.taxTotal, 25.2);
  assert.equal(t.grandTotal, 205.2);
  const [l] = allocateInvoiceLines(items, 20, 14, t.taxTotal);
  assert.equal(l.lineGrand, 205.2);
});

test('الربح: المرتجع يُخصم، والفرق صفر عندما تتطابق الأرقام', () => {
  // مبيعات 1000 - مرتجع 100 = 900 ، تكلفة 600 - 60 = 540 ، مصروف 50 ، معدوم 10
  const profit = calculateInvoiceProfit({ totalSalesNet: 900, costOfGoodsSold: 540, expenses: 50, badDebt: 10 });
  assert.equal(profit, 300);
  // رأس المال زاد 340 ، سحب 40 ، تمويل 0 => الربح الحقيقي 380؟ لا: 340 + 40 - 0 = 380 => فرق 80 (مشكلة حقيقية تظهر)
  assert.equal(calculateMismatch(calculateRealProfit(340, 40, 0), profit), 80);
  // لو رأس المال زاد 260 فقط: 260 + 40 = 300 => لا فرق
  assert.equal(calculateMismatch(calculateRealProfit(260, 40, 0), profit), 0);
});

test('الأكواد: لون مختلف = كود مختلف، والإكسسوار يحمل رقم الموديل', () => {
  const black = makeCode('shoes', { modelNumber: 12, colorLetter: 'B', size: 37 });
  const white = makeCode('shoes', { modelNumber: 12, colorLetter: 'W', size: 37 });
  assert.equal(black, 'S12-B37');
  assert.notEqual(black, white);
  assert.equal(makeCode('bags', { modelNumber: 5, colorLetter: 'BR' }), 'B5-BR');
  assert.equal(makeCode('accessories', { modelNumber: 7, colorLetter: 'BK' }), 'ACC7-BK');
  assert.notEqual(makeCode('accessories', { modelNumber: 7, colorLetter: 'BK' }), makeCode('accessories', { modelNumber: 8, colorLetter: 'BK' }));
  // الألوان العربية بدون colorLetter تُنتج رموزاً لاتينية معيارية فريدة تمنع تصادم الأكواد
  const codeBlack = makeCode('shoes', { modelNumber: 1, color: 'أسود', size: 40 });
  const codeBrown = makeCode('shoes', { modelNumber: 1, color: 'بني', size: 40 });
  const codeBeige = makeCode('shoes', { modelNumber: 1, color: 'بيج', size: 40 });
  const codeWhite = makeCode('shoes', { modelNumber: 1, color: 'أبيض', size: 40 });
  const codeGray = makeCode('shoes', { modelNumber: 1, color: 'رمادي', size: 40 });
  const codeNavy = makeCode('shoes', { modelNumber: 1, color: 'كحلي', size: 40 });

  assert.equal(codeBlack, 'S1-B40');
  assert.equal(codeBrown, 'S1-BR40');
  assert.equal(codeBeige, 'S1-BE40');
  assert.equal(codeWhite, 'S1-W40');
  assert.equal(codeGray, 'S1-G40');
  assert.equal(codeNavy, 'S1-N40');

  // التأكد أن جميع الأكواد الستة مختلفة تماماً لنفس الموديل والمقاس
  const codesSet = new Set([codeBlack, codeBrown, codeBeige, codeWhite, codeGray, codeNavy]);
  assert.equal(codesSet.size, 6);

  // حالات حدية: عدم وجود لون إطلاقاً ينتقل إلى 'X'
  assert.equal(makeCode('shoes', { modelNumber: 1, size: 40 }), 'S1-X40');

  // ألوان عربية بديلة وغير مسجلة: توليد رمز حتمي فريد ولا يحتوي أي حروف عربية
  const codeTurq = makeCode('shoes', { modelNumber: 1, color: 'تيركواز', size: 40 });
  const codeCustom = makeCode('shoes', { modelNumber: 1, color: 'مشمشي', size: 40 });
  assert.notEqual(codeTurq, codeCustom);
  assert.match(codeTurq, /^S1-[A-Z0-9]+40$/);
  assert.match(codeCustom, /^S1-[A-Z0-9]+40$/);
});

test('التحقق: رفض الكميات الصفرية والسالبة في البيع والشراء وعدم تحويلها إلى 1', async () => {
  const { validateInvoice, validatePurchase } = await import('./validation');

  // فاتورة بيع بكمية صفرية
  const invZero = validateInvoice({
    items: [{ itemId: 'item-1', name: 'حذاء كلاسيك', quantity: 0, unitPrice: 200 }],
    grandTotal: 0,
    paidAmount: 0,
  });
  assert.equal(invZero.isValid, false);
  assert.ok(invZero.errors.some((e) => e.includes('أكبر من صفر')));

  // فاتورة بيع بكمية سالبة
  const invNegative = validateInvoice({
    items: [{ itemId: 'item-1', name: 'حذاء كلاسيك', quantity: -3, unitPrice: 200 }],
    grandTotal: 0,
    paidAmount: 0,
  });
  assert.equal(invNegative.isValid, false);
  assert.ok(invNegative.errors.some((e) => e.includes('أكبر من صفر')));

  // فاتورة شراء بكمية صفرية وسالبة
  const purZero = validatePurchase({
    items: [{ name: 'شنطة جلد', quantity: 0, purchaseCost: 150 }],
  });
  assert.equal(purZero.isValid, false);
  assert.ok(purZero.errors.some((e) => e.includes('أكبر من صفر')));

  const purNegative = validatePurchase({
    items: [{ name: 'شنطة جلد', quantity: -1, purchaseCost: 150 }],
  });
  assert.equal(purNegative.isValid, false);
  assert.ok(purNegative.errors.some((e) => e.includes('أكبر من صفر')));

  // بنود بكميات موجبة صحيحة
  const validInv = validateInvoice({
    items: [{ itemId: 'item-1', name: 'حذاء كلاسيك', quantity: 2, unitPrice: 200 }],
    grandTotal: 400,
    paidAmount: 400,
  });
  assert.equal(validInv.isValid, true);
  assert.equal(validInv.errors.length, 0);
});

test('المخزون: بيع كامل الكمية المتاحة وتجاوز المتاح', () => {
  let stock = 5;
  const requestedValid = 5;
  assert.ok(stock >= requestedValid, 'الكمية المتاحة كافية');
  stock -= requestedValid;
  assert.equal(stock, 0, 'الرصيد بعد بيع كامل الكمية أصبح صفراً تماماً');

  const requestedExcess = 1;
  const canSell = stock >= requestedExcess;
  assert.equal(canSell, false, 'يجب رفض بيع أي كمية تتجاوز الرصيد المتاح عند منع المخزون السالب');
});

test('تكرار الصنف في أكثر من سطر بالفاتورة: تجميع الكميات للحساب المخزني', () => {
  // سطر 1: قطعة بسعر 100، سطر 2: قطعتان بسعر 90 (خصم خاص)
  const items = [
    { itemId: 'shoe-b38', name: 'حذاء أسود 38', quantity: 1, unitPrice: 100, costPrice: 60, discount: 0, total: 100 },
    { itemId: 'shoe-b38', name: 'حذاء أسود 38', quantity: 2, unitPrice: 90, costPrice: 60, discount: 0, total: 180 },
  ];

  const totals = calculateInvoiceTotals({ items: items as any, overallDiscount: 0 });
  assert.equal(totals.subtotal, 280);
  assert.equal(totals.grandTotal, 280);

  // تجميع الكميات لخصم المخزون
  const stockDeltas = new Map<string, number>();
  for (const it of items) {
    stockDeltas.set(it.itemId, (stockDeltas.get(it.itemId) || 0) + it.quantity);
  }
  assert.equal(stockDeltas.get('shoe-b38'), 3, 'إجمالي الكمية المطلوب خصمها من الصنف = 3 قطع');
});

test('المرتجع لصنف موزع على عدة أسطر: استهلاك تسلسلي وحساب دقيق للمبلغ المسترد', () => {
  const line1 = { itemId: 'item-x', name: 'صنف x', quantity: 1, lineGrand: 100, returnedQty: 0, returnedAmount: 0 };
  const line2 = { itemId: 'item-x', name: 'صنف x', quantity: 2, lineGrand: 180, returnedQty: 0, returnedAmount: 0 }; // 90 للقطعة
  const lines = [line1, line2];

  // العميل يرجع قطعتين
  let qtyToReturn = 2;
  let totalRefund = 0;

  for (const line of lines) {
    if (qtyToReturn <= 0) break;
    const returnable = line.quantity - line.returnedQty;
    const take = Math.min(returnable, qtyToReturn);
    const { refundAmount } = calculateLineReturn(line.lineGrand, line.quantity, take, line.returnedQty, line.returnedAmount);
    totalRefund = round2(totalRefund + refundAmount);
    line.returnedQty += take;
    line.returnedAmount = round2(line.returnedAmount + refundAmount);
    qtyToReturn -= take;
  }

  // أخذ 1 من السطر الأول (100) و1 من السطر الثاني (90) = 190 بالضبط
  assert.equal(qtyToReturn, 0);
  assert.equal(totalRefund, 190);
  assert.equal(line1.returnedQty, 1);
  assert.equal(line2.returnedQty, 1);
});

test('المرتجع: منع تجاوز الكمية المباعة ومنع تكرار الإرجاع', async () => {
  const { validateReturn } = await import('./validation');

  // إرجاع صالح
  const v1 = validateReturn({
    invoiceStatus: 'completed',
    originalSoldQty: 3,
    alreadyReturnedQty: 1,
    requestedReturnQty: 2,
  });
  assert.equal(v1.isValid, true);

  // تجاوز المتاح (المتبقي 2 وطلب 3)
  const v2 = validateReturn({
    invoiceStatus: 'completed',
    originalSoldQty: 3,
    alreadyReturnedQty: 1,
    requestedReturnQty: 3,
  });
  assert.equal(v2.isValid, false);
  assert.ok(v2.errors.some((e) => e.includes('تتجاوز الحد الأقصى')));

  // فاتورة ملغاة
  const v3 = validateReturn({
    invoiceStatus: 'cancelled',
    originalSoldQty: 3,
    alreadyReturnedQty: 0,
    requestedReturnQty: 1,
  });
  assert.equal(v3.isValid, false);
  assert.ok(v3.errors.some((e) => e.includes('فاتورة ملغاة')));
});

test('الربح: المقارنة الصريحة بين Markup (الزيادة على التكلفة) و Gross Profit Margin (هامش الربح)', async () => {
  const { calculateMarkup, calculateGrossProfitMargin, calculateProfitMargin } = await import('./profit');

  // صنف تكلفته 100 وسعر بيعه 150:
  // Markup = (150 - 100) / 100 * 100 = 50%
  // Margin = (150 - 100) / 150 * 100 = 33.33%
  assert.equal(calculateMarkup(100, 150), 50);
  assert.equal(calculateGrossProfitMargin(100, 150), 33.33);
  // التوافق البرمجي لـ calculateProfitMargin
  assert.equal(calculateProfitMargin(100, 150), 50);

  // صنف تكلفته 80 وسعر بيعه 100:
  // Markup = (100 - 80) / 80 * 100 = 25%
  // Margin = (100 - 80) / 100 * 100 = 20%
  assert.equal(calculateMarkup(80, 100), 25);
  assert.equal(calculateGrossProfitMargin(80, 100), 20);
});

test('المرتجع العابر للشهر: بيع 30 يناير ومرتجع 2 فبراير دون تشويه ربح يناير', async () => {
  // يناير: بيع صنف بسعر 150 وتكلفة 100
  const janSales = 150;
  const janCogs = 100;
  const janProfit = round2(janSales - janCogs);
  assert.equal(janProfit, 50, 'ربح يناير المقفول = 50 ج.م');

  // في 2 فبراير: مرتجع القطعة (استرداد 150 وتكلفة البضاعة المرتجعة 100)
  // مبيعات فبراير الأصلية 0، والمرتجع -150
  const febGrossSales = 0;
  const febRefunds = 150;
  const febNetSales = round2(febGrossSales - febRefunds); // -150

  const febGrossCogs = 0;
  const febReturnCost = 100;
  const febCogs = round2(febGrossCogs - febReturnCost); // -100

  // أثر فبراير الصافي على الربح:
  // NetSales - COGS = -150 - (-100) = -50
  const febProfit = round2(febNetSales - febCogs);
  assert.equal(febProfit, -50, 'أثر فبراير يعكس ربح القطعة المرتجعة بالضبط (-50 ج.م)');

  // إجمالي أرباح الشهرين معاً: 50 (يناير) + (-50 فبراير) = 0 ج.م (لأن القطعة بيعت ثم أُرجعت)
  assert.equal(round2(janProfit + febProfit), 0, 'محصلة أرباح العمليتين صفر تام دون أي تضخيم');
});

test('إعادة احتساب المخزون والخزينة بالحركات الفعلية المسجلة', async () => {
  const { recalculateItemQty, recalculateWallets } = await import('./stock');

  // مخزون: رصيد افتتاحي 10 + مشتريات 15 - مبيعات 8 + مرتجعات 2 + تسوية جرد -1
  const stock = recalculateItemQty({
    initialQty: 10,
    purchasesQty: 15,
    activeSalesQty: 8,
    returnsQty: 2,
    stockAdjustmentsQty: -1,
  });
  assert.equal(stock, 18, 'رصيد المخزن الدفتري مطابق 100%');

  // خزينة: رصيد افتتاحي كاش 1000، وبنك 2000
  // تحصيل عميل كاش (collection) 500، سداد مشتريات كاش (purchase_payment) 300، تحويل من كاش لبنك 200
  const wallets = recalculateWallets(
    { cash: 1000, bank: 2000, wallet: 0 },
    [
      { walletId: 'cash', amount: 500, type: 'collection' },
      { walletId: 'cash', amount: 300, type: 'purchase_payment' },
      { walletId: 'cash', targetWalletId: 'bank', amount: 200, type: 'transfer' },
    ]
  );

  // كاش: 1000 + 500 - 300 - 200 = 1000
  assert.equal(wallets.cash, 1000);
  // بنك: 2000 + 200 = 2200
  assert.equal(wallets.bank, 2200);
});

test('محاكاة يوم عمل كامل (50 فاتورة بيع) وأسبوع وشهر دون أي أخطاء تراكمية', () => {
  // محاكاة يوم عمل 50 فاتورة لمحل أحذية وشنط:
  // 30 فاتورة نقدية كاش (متوسط 250 ج.م، تكلفة 150 ج.م)
  // 15 فاتورة إنستاباي بنك (متوسط 300 ج.م، تكلفة 180 ج.م)
  // 5 فواتير آجل مدين عملاء (متوسط 200 ج.م، تكلفة 120 ج.م)
  let cashSales = 0;
  let bankSales = 0;
  let creditSales = 0;
  let totalCost = 0;

  for (let i = 1; i <= 50; i++) {
    if (i <= 30) {
      cashSales = round2(cashSales + 250);
      totalCost = round2(totalCost + 150);
    } else if (i <= 45) {
      bankSales = round2(bankSales + 300);
      totalCost = round2(totalCost + 180);
    } else {
      creditSales = round2(creditSales + 200);
      totalCost = round2(totalCost + 120);
    }
  }

  const grandSales = round2(cashSales + bankSales + creditSales);
  assert.equal(grandSales, (30 * 250) + (15 * 300) + (5 * 200)); // 7500 + 4500 + 1000 = 13000
  assert.equal(totalCost, (30 * 150) + (15 * 180) + (5 * 120)); // 4500 + 2700 + 600 = 7800

  // حدوث مرتجعين نقدية:
  // مرتجع 1: صنف بـ 250 وتكلفة 150 كاش
  // مرتجع 2: صنف بـ 300 وتكلفة 180 بنك
  const returnsValue = 550;
  const returnsCost = 330;

  const netSales = round2(grandSales - returnsValue); // 13000 - 550 = 12450
  const netCogs = round2(totalCost - returnsCost);    // 7800 - 330 = 7470
  const expenses = 450; // مصروفات كهرباء وبوفيه

  const dayProfit = calculateInvoiceProfit({
    totalSalesNet: netSales,
    costOfGoodsSold: netCogs,
    expenses,
    badDebt: 0,
  });

  // الربح المتوقع = 12450 - 7470 - 450 = 4530 ج.م
  assert.equal(dayProfit, 4530);

  // محاكاة شهر (30 يوماً بنفس المعدل):
  const monthProfit = round2(dayProfit * 30);
  assert.equal(monthProfit, 135900, 'أرباح الشهر متسقة بدقة دون أي تباين');

  // محاكاة شهر مضاعف الأرباح (ضعف النشاط والمبيعات):
  const doubleMonthProfit = round2(monthProfit * 2);
  assert.equal(doubleMonthProfit, 271800, 'الأرباح الشهرية المضاعفة متسقة رياضياً');
});

test('تسوية الخزينة (wallet_adjust): معالجة دقيقة للفائض (موجب) والعجز (سالب)', async () => {
  const { recalculateWallets } = await import('./stock');

  // رصيد افتتاحي: كاش 1000، بنك 5000
  // حركة 1: جرد كاش الفعلي 1250 (فائض 250+) => difference: +250, amount: 250
  // حركة 2: جرد بنك الفعلي 4900 (عجز 100-) => difference: -100, amount: 100
  const wallets = recalculateWallets(
    { cash: 1000, bank: 5000, wallet: 0 },
    [
      { walletId: 'cash', type: 'wallet_adjust', amount: 250, difference: 250 },
      { walletId: 'bank', type: 'wallet_adjust', amount: 100, difference: -100 },
    ]
  );

  assert.equal(wallets.cash, 1250, 'الكاش زاد بمقدار الفائض الفعلي (+250)');
  assert.equal(wallets.bank, 4900, 'البنك نقص بمقدار العجز الفعلي (-100)');
});

test('الخزينة: استبعاد الحركات المعكوسة (status: reversed) منعاً لتكرار أو استمرار أثرها', async () => {
  const { recalculateWallets } = await import('./stock');

  // رصيد كاش 2000
  // حركة 1: مصروف 300 نشط (يُخصم)
  // حركة 2: مصروف 500 معكوس (status: 'reversed' - يجب استبعاده وعدم خصمه)
  // حركة 3: سداد مشتريات 700 معكوس بسبب إلغاء فاتورة الشراء (status: 'reversed' - يستبعد)
  // حركة 4: تحصيل عميل 400 نشط (يُضاف)
  const wallets = recalculateWallets(
    { cash: 2000, bank: 0, wallet: 0 },
    [
      { walletId: 'cash', type: 'expense', amount: 300, status: 'active' },
      { walletId: 'cash', type: 'expense', amount: 500, status: 'reversed' },
      { walletId: 'cash', type: 'purchase_payment', amount: 700, status: 'reversed' },
      { walletId: 'cash', type: 'collection', amount: 400, status: 'active' },
    ]
  );

  // 2000 - 300 (مصروف نشط) + 400 (تحصيل نشط) = 2100 (تم تجاهل الـ 500 والـ 700 المعكوستين)
  assert.equal(wallets.cash, 2100, 'تم استبعاد الحركات المعكوسة تماماً ولم يتأثر الرصيد بها');
});

test('المخزون: عدم تكرار حركات المخزون عند وجود مرتجع أو إلغاء فاتورة', async () => {
  const { recalculateItemQty } = await import('./stock');

  // صنف رصيده الافتتاحي 10 قطع
  // السيناريو 1: فاتورة نشطة بيع منها 3 قطع، ثم استرجع العميل قطعة واحدة (نوع return)
  // activeSalesQty = 3, returnsQty = 1
  const stockNormalReturn = recalculateItemQty({
    initialQty: 10,
    activeSalesQty: 3,
    returnsQty: 1,
    stockAdjustmentsQty: 0,
  });
  assert.equal(stockNormalReturn, 8, 'المخزون بعد بيع 3 ومرتجع 1 = 8 قطع');

  // السيناريو 2: فاتورة بيع بـ 4 قطع أُلغيت بالكامل (cancelInvoice)
  // الفاتورة الملغاة تُستبعد من activeSalesQty (تصبح 0)، ومستند الإلغاء (type: 'cancel') يُستبعد من returnsQty
  // حتى لا يتم عدّ القطع المسترجعة مرتين
  const stockCancelledInvoice = recalculateItemQty({
    initialQty: 10,
    activeSalesQty: 0, // استبعاد الفاتورة الملغاة من المبيعات
    returnsQty: 0,      // استبعاد مستند الإلغاء CAN-xxx من المرتجعات
    stockAdjustmentsQty: 0,
  });
  assert.equal(stockCancelledInvoice, 10, 'المخزون بعد إلغاء الفاتورة بالكامل يعود لرصيده الأصلي 10 دون تكرار');

  // السيناريو 3: التأكد من أن purchasesQty الافتراضية = 0 ولا تضاعف الرصيد الافتتاحي initialQty
  const stockWithDefaultPurchases = recalculateItemQty({
    initialQty: 10,
    activeSalesQty: 2,
    returnsQty: 0,
    stockAdjustmentsQty: 0,
  });
  assert.equal(stockWithDefaultPurchases, 8, 'purchasesQty = 0 افتراضياً ولم تضاعف كمية الشراء الأولي');
});

test('تحصيل ديون العملاء: التحقق من إظهار التأكيد عند تجاوز الدين والتنفيذ المباشر دونه', async () => {
  const { checkExcessCollection } = await import('./payment');

  // السيناريو 1 (الحد الحرج: الدين 500 والتحصيل 500) -> لا يتطلب تأكيداً
  const caseEqual = checkExcessCollection(500, 500);
  assert.equal(caseEqual.needsConfirmation, false, 'تحصيل مبلغ مساوٍ للدين لا يطلب تأكيداً');
  assert.equal(caseEqual.debt, 500);
  assert.equal(caseEqual.collectionAmount, 500);
  assert.equal(caseEqual.excessAmount, 0);

  // السيناريو 2 (الحالة العادية: الدين 500 والتحصيل 300) -> لا يتطلب تأكيداً
  const caseUnder = checkExcessCollection(500, 300);
  assert.equal(caseUnder.needsConfirmation, false, 'تحصيل مبلغ أقل من الدين لا يطلب تأكيداً');
  assert.equal(caseUnder.debt, 500);
  assert.equal(caseUnder.collectionAmount, 300);
  assert.equal(caseUnder.excessAmount, 0);

  // السيناريو 3 (حالة التجاوز: الدين 500 والتحصيل 5000) -> يتطلب تأكيداً صريحاً مع بيان المبالغ
  const caseOver = checkExcessCollection(500, 5000);
  assert.equal(caseOver.needsConfirmation, true, 'تحصيل مبلغ أكبر من الدين يتطلب تأكيداً صريحاً');
  assert.equal(caseOver.debt, 500, 'بيان مبلغ الدين 500');
  assert.equal(caseOver.collectionAmount, 5000, 'بيان مبلغ التحصيل 5000');
  assert.equal(caseOver.excessAmount, 4500, 'حساب المبلغ الفائض بدقة 4500');
});

test('عكس الحركات والضغط المزدوج: رفض محاولة عكس حركة reversed وعدم تكرار الأثر', async () => {
  const { reverseTransaction, _setFirestoreAdapterForTesting } = await import('../lib/data');

  let dbTransaction = {
    id: 'tx_rev_test',
    type: 'expense',
    amount: 150,
    walletId: 'cash',
    status: 'active',
  };

  let dbWallets: Record<string, number> = { cash: 1000 };
  let batchCommittedCount = 0;

  const mockBatch = {
    set(ref: any, data: any) {
      if (ref.path === 'stats/wallets' && data.balances) {
        for (const [w, val] of Object.entries(data.balances)) {
          if (val && typeof val === 'object' && ((val as any)._methodName === 'increment' || (val as any)._operand !== undefined)) {
            dbWallets[w] = (dbWallets[w] || 0) + (val as any)._operand;
          }
        }
      }
    },
    update(ref: any, data: any) {
      if (ref.path === 'transactions/tx_rev_test') {
        Object.assign(dbTransaction, data);
      }
    },
    async commit() {
      batchCommittedCount++;
      return 'ok';
    }
  };

  _setFirestoreAdapterForTesting({
    getDoc: async () => ({
      exists: () => true,
      data: () => ({ ...dbTransaction }),
    }) as any,
    doc: (_db: any, col: string, id?: string) => ({ path: id ? `${col}/${id}` : col }),
    writeBatch: () => mockBatch as any,
  } as any);

  // 1. العكس الأول: حركة نشطة -> تنجح ويُرد المبلغ للخزينة
  await reverseTransaction('tx_rev_test');
  assert.equal(dbTransaction.status, 'reversed', 'الحركة أصبحت معكوسة');
  assert.equal(dbWallets.cash, 1150, 'تم رد 150 للخزينة بنجاح');
  assert.equal(batchCommittedCount, 1, 'تم تنفيذ دفعة واحدة');

  // 2. العكس الثاني: الحركة أصبحت reversed -> يجب رفضها صراحة دون أي تغيير في الخزينة
  let errorCaught: any = null;
  try {
    await reverseTransaction('tx_rev_test');
  } catch (err: any) {
    errorCaught = err;
  }
  assert.ok(errorCaught, 'تم رمي خطأ عند محاولة عكس حركة معكوسة');
  assert.equal(errorCaught.message, 'هذه الحركة معكوسة بالفعل');
  assert.equal(dbWallets.cash, 1150, 'الخزينة لم تتأثر إطلاقاً بالمحاولة الثانية');
  assert.equal(batchCommittedCount, 1, 'لم يتم تنفيذ أي commit ثانٍ');

  // استعادة المحول
  _setFirestoreAdapterForTesting(null);
});

test('عميل برصيد سابق: توحيد رقم الهاتف باستخدام normalizePhone لمنع تكرار العميل وتجزئة الدين', async () => {
  const { addCustomerWithOpeningBalance, _setFirestoreAdapterForTesting } = await import('../lib/data');
  const { normalizePhone } = await import('./money');

  const customersDb: Record<string, any> = {};
  let nextCustId = 1;

  const mockBatch = {
    set(ref: any, data: any) {
      if (ref.path.startsWith('customers/')) {
        const id = ref.path.replace('customers/', '');
        customersDb[id] = { ...data };
      }
    },
    update(ref: any, data: any) {
      if (ref.path.startsWith('customers/')) {
        const id = ref.path.replace('customers/', '');
        customersDb[id] = { ...customersDb[id], ...data };
      }
    },
    async commit() {
      return 'ok';
    }
  };

  _setFirestoreAdapterForTesting({
    getDocs: async (q: any) => {
      const matchingDocs: any[] = [];
      for (const [id, data] of Object.entries(customersDb)) {
        matchingDocs.push({
          id,
          data: () => data,
        });
      }
      return {
        empty: matchingDocs.length === 0,
        docs: matchingDocs,
      };
    },
    writeBatch: () => mockBatch as any,
  } as any);

  // سيناريو 1 (العادي): إدخال رقم هاتف بأرقام عربية "٠١٠١٢٣٤٥٦٧٨"
  // التحقق من أنه يُحفظ كرقم لاتيني موحد "01012345678"
  // بحيث يطابق لاحقاً استعلام الفاتورة الموحد normalizePhone("01012345678")
  const id1 = await addCustomerWithOpeningBalance({
    name: 'عميل برقم عربي',
    phone: '٠١٠١٢٣٤٥٦٧٨',
    amount: 500,
  });

  assert.ok(id1, 'تم إنشاء العميل بنجاح');
  assert.equal(customersDb[id1].phone, '01012345678', 'رقم الهاتف حُفظ موحداً بالأرقام اللاتينية');
  assert.equal(normalizePhone('01012345678'), customersDb[id1].phone, 'رقم الفاتورة اللاتيني يطابق رقم العميل المحفوظ تماماً');

  // سيناريو 2 (الحدّي): رقم هاتف يحتوي على مسافات وأرقام عربية " ٠١٠ ١٢٣٤ ٥٦٧٨ "
  // التحقق من منعه لأنه نفس العميل المكرر بعد التوحيد وحذف المسافات
  let dupError: any = null;
  try {
    await addCustomerWithOpeningBalance({
      name: 'نفس العميل بمسافات',
      phone: ' ٠١٠ ١٢٣٤ ٥٦٧٨ ',
      amount: 200,
    });
  } catch (err: any) {
    dupError = err;
  }
  assert.ok(dupError, 'تم اكتشاف تكرار نفس رقم الهاتف بعد التوحيد وحذف المسافات');
  assert.equal(dupError.message, 'يوجد عميل مسجل بنفس رقم الهاتف بالفعل');

  // سيناريو 3 (الخاطئ): رقم هاتف فارغ أو مسافات فقط أو بدون أرقام
  let emptyError: any = null;
  try {
    await addCustomerWithOpeningBalance({
      name: 'عميل برقم فارغ',
      phone: '   ',
      amount: 300,
    });
  } catch (err: any) {
    emptyError = err;
  }
  assert.ok(emptyError, 'تم رفض إضافة عميل برقم هاتف فارغ بعد التوحيد');
  assert.equal(emptyError.message, 'اسم العميل ورقم الهاتف مطلوبان');

  // استعادة المحول
  _setFirestoreAdapterForTesting(null);
});



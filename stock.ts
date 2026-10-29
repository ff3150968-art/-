/**
 * Stock balance recalculation and adjustment utilities for «محلي»
 */

import { StockAdjustment, WalletId } from './types';
import { round2 } from './money';

export interface StockAdjustmentCalcResult {
  differenceQty: number; // الفرق = المعدود - المسجل
  totalCostImpact: number; // القيمة = الفرق × سعر الشراء
}

/**
 * حساب تسوية الجرد المخزني
 * الفرق = المعدود - المسجل
 * القيمة = الفرق × سعر الشراء / التكلفة
 */
export function calculateStockAdjustment(
  countedQty: number,
  recordedQty: number,
  costPrice: number
): StockAdjustmentCalcResult {
  const differenceQty = round2(countedQty - recordedQty);
  const totalCostImpact = round2(differenceQty * costPrice);

  return {
    differenceQty,
    totalCostImpact,
  };
}

export interface RecalculateItemQtyParams {
  initialQty: number;          // الرصيد الابتدائي للصنف (يشمل كمية الشراء التأسيسي)
  activeSalesQty: number;      // إجمالي الكميات المباعة في الفواتير المكتملة/النشطة فقط (غير الملغاة)
  returnsQty: number;          // كميات المرتجعات الفعلية للفواتير النشطة فقط (تستبعد سجلات الإلغاء cancel)
  stockAdjustmentsQty: number; // مجموع فروق الجرد المخزني (المعدود - المسجل، سواء موجبة أو سالبة)
  purchasesQty?: number;       // توريدات إضافية لاحقة للصنف إن وجدت فقط (تلقائياً صفر لتجنب تكرار initialQty)
}

/**
 * إعادة احتساب رصيد صنف معين من أصل الحركات
 * الكمية = initialQty + purchasesQty - مبيعات الفواتير النشطة + المرتجعات الفعلية + فروق الجرد
 */
export function recalculateItemQty({
  initialQty,
  activeSalesQty,
  returnsQty,
  stockAdjustmentsQty,
  purchasesQty = 0,
}: RecalculateItemQtyParams): number {
  const calculated = initialQty + purchasesQty - activeSalesQty + returnsQty + stockAdjustmentsQty;
  return round2(calculated);
}

export interface WalletTransactionEntry {
  walletId: WalletId;
  targetWalletId?: WalletId;
  amount: number;
  difference?: number; // فارق التسوية الفعلي في حركات تسوية الخزينة (wallet_adjust): موجب = فائض، سالب = عجز
  status?: 'active' | 'reversed' | string; // حالة الحركة: يتم استبعاد 'reversed' لمنع تكرار الأثر
  type:
    | 'income'
    | 'expense'
    | 'transfer'
    | 'customer_payment'
    | 'collection'
    | 'supplier_payment'
    | 'purchase_payment'
    | 'sale'
    | 'purchase'
    | 'refund'
    | 'capital'
    | 'capital_in'
    | 'withdrawal'
    | 'wallet_adjust'
    | string;
}

/**
 * إعادة حساب أرصدة الخزائن من السجلات وحركات القيود للمقارنة والتدقيق
 */
export function recalculateWallets(
  openingBalances: Record<WalletId, number>,
  transactions: WalletTransactionEntry[]
): Record<WalletId, number> {
  const result: Record<WalletId, number> = { ...openingBalances };

  // تهيئة الأرصدة
  Object.keys(result).forEach((wId) => {
    result[wId] = round2(result[wId] || 0);
  });

  for (const tx of transactions) {
    // استبعاد الحركات المعكوسة (reverseTransaction أو cancelPurchase) لمنع احتساب الأثر مرتين
    if (tx.status === 'reversed') {
      continue;
    }

    const amount = round2(tx.amount);
    if (!amount && tx.difference === undefined) continue;

    if (!result[tx.walletId]) {
      result[tx.walletId] = 0;
    }

    switch (tx.type) {
      case 'income':
      case 'customer_payment':
      case 'collection':
      case 'sale':
      case 'capital':
      case 'capital_in':
        result[tx.walletId] = round2(result[tx.walletId] + amount);
        break;

      case 'expense':
      case 'supplier_payment':
      case 'purchase_payment':
      case 'purchase':
      case 'refund':
      case 'withdrawal':
        result[tx.walletId] = round2(result[tx.walletId] - amount);
        break;

      case 'transfer':
        result[tx.walletId] = round2(result[tx.walletId] - amount);
        if (tx.targetWalletId) {
          if (!result[tx.targetWalletId]) {
            result[tx.targetWalletId] = 0;
          }
          result[tx.targetWalletId] = round2(result[tx.targetWalletId] + amount);
        }
        break;

      case 'wallet_adjust': {
        // في closeMonthSnapshot يتم حفظ amount: Math.abs(diff) و difference: diff
        // حيث diff = round2(actual - system): موجب للفائض وسالب للعجز
        const diff = tx.difference !== undefined ? round2(tx.difference) : amount;
        result[tx.walletId] = round2(result[tx.walletId] + diff);
        break;
      }
    }
  }

  return result;
}

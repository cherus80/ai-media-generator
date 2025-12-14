/**
 * Payment Store (Zustand)
 * Управление состоянием платежей и тарифов
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  createPayment,
  getTariffs,
  getPaymentHistory,
  openPaymentWindow,
  hidePayments as hidePaymentsApi,
} from '../api/payment';
import { useAuthStore } from './authStore';
import type {
  BackendTariff,
  PaymentType,
  SubscriptionType,
  SelectedTariff,
  TariffInfo,
  PaymentHistoryItem,
  PaymentCreateRequest,
} from '../types/payment';

const extractErrorMessage = (error: any, fallback: string): string => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message || JSON.stringify(item))
      .join('; ');
  }

  if (detail && typeof detail === 'object') {
    return detail.message || JSON.stringify(detail);
  }

  return error?.message || fallback;
};

/**
 * Интерфейс состояния store
 */
interface PaymentState {
  // State
  selectedType: PaymentType | null;
  selectedTariff: SelectedTariff | null;
  tariffs: TariffInfo | null;
  paymentHistory: PaymentHistoryItem[];
  isLoading: boolean;
  error: string | null;
  currentPaymentId: string | null;

  // Actions
  setSelectedType: (type: PaymentType) => void;
  selectSubscription: (type: SubscriptionType) => void;
  selectCreditsPackage: (creditsAmount: number) => void;
  loadTariffs: () => Promise<void>;
  loadPaymentHistory: (page?: number, pageSize?: number) => Promise<void>;
  hidePayments: (paymentIds: number[]) => Promise<void>;
  createPayment: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

/**
 * Initial state
 */
const initialState = {
  selectedType: null,
  selectedTariff: null,
  tariffs: null,
  paymentHistory: [],
  isLoading: false,
  error: null,
  currentPaymentId: null,
};

/**
 * Payment Store
 */
export const usePaymentStore = create<PaymentState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Установить тип платежа (подписка или кредиты)
       */
      setSelectedType: (type: PaymentType) => {
        set({
          selectedType: type,
          selectedTariff: null,
          error: null,
        });
      },

      /**
       * Выбрать тариф подписки
       */
      selectSubscription: (type: SubscriptionType) => {
        const { tariffs } = get();
        if (!tariffs) {
          set({ error: 'Тарифы не загружены' });
          return;
        }

        const tariff = tariffs.subscription_tariffs.find(
          (t) => t.type === type
        );

        if (!tariff) {
          set({ error: 'Тариф не найден' });
          return;
        }

        set({
          selectedType: 'subscription',
          selectedTariff: {
            type: 'subscription',
            subscription: type,
            price: tariff.price,
            description: `${tariff.name} — ${tariff.actions_count} действий на ${tariff.duration_days} дней`,
          },
          error: null,
        });
      },

      /**
       * Выбрать пакет кредитов
       */
      selectCreditsPackage: (creditsAmount: number) => {
        const { tariffs } = get();
        if (!tariffs) {
          set({ error: 'Тарифы не загружены' });
          return;
        }

        const pkg = tariffs.credits_packages.find(
          (p) => p.credits_amount === creditsAmount
        );

        if (!pkg) {
          set({ error: 'Пакет кредитов не найден' });
          return;
        }

        const totalCredits = pkg.credits_amount + (pkg.bonus_credits || 0);
        const bonusText = pkg.bonus_credits
          ? ` + ${pkg.bonus_credits} бонусных`
          : '';

        set({
          selectedType: 'credits',
          selectedTariff: {
            type: 'credits',
            credits_amount: creditsAmount,
            price: pkg.price,
            description: `${totalCredits} кредитов${bonusText}`,
          },
          error: null,
        });
      },

      /**
       * Загрузить список тарифов
       */
      loadTariffs: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await getTariffs();

          const mapSubscription = (tariff: BackendTariff) => ({
            type: tariff.tariff_id as SubscriptionType,
            name: tariff.name,
            description: tariff.description,
            price: Number(tariff.price),
            currency: '₽',
            actions_count: tariff.actions_limit ?? tariff.credits_amount ?? 0,
            duration_days: tariff.duration_days ?? 30,
            is_recommended: tariff.is_popular ?? false,
            features: [
              `${tariff.actions_limit ?? tariff.credits_amount ?? 0} действий`,
              `Срок ${tariff.duration_days ?? 30} дней`,
            ],
          });

          const mapCredits = (tariff: BackendTariff) => ({
            credits_amount: tariff.credits_amount ?? 0,
            price: Number(tariff.price),
            currency: '₽',
            bonus_credits: 0,
            is_popular: tariff.is_popular ?? false,
            description: tariff.description,
          });

          const mappedTariffs: TariffInfo = {
            subscription_tariffs: response.subscriptions.map(mapSubscription),
            credits_packages: response.credits_packages.map(mapCredits),
          };

          set({
            tariffs: mappedTariffs,
            isLoading: false,
          });
        } catch (error: any) {
          console.error('Failed to load tariffs:', error);
          set({
            error: extractErrorMessage(error, 'Не удалось загрузить тарифы'),
            isLoading: false,
          });
        }
      },

      /**
       * Загрузить историю платежей
       */
      loadPaymentHistory: async (page: number = 1, pageSize: number = 20) => {
        set({ isLoading: true, error: null });

        try {
          const response = await getPaymentHistory(page, pageSize);
          set({
            paymentHistory: response.items,
            isLoading: false,
          });
        } catch (error: any) {
          console.error('Failed to load payment history:', error);
          set({
            error: extractErrorMessage(
              error,
              'Не удалось загрузить историю платежей'
            ),
            isLoading: false,
          });
        }
      },

      /**
       * Скрыть выбранные платежи из истории
       */
      hidePayments: async (paymentIds: number[]) => {
        if (!paymentIds.length) {
          return;
        }

        set({ error: null, isLoading: true });

        try {
          await hidePaymentsApi(paymentIds);
          const { paymentHistory } = get();
          set({
            paymentHistory: paymentHistory.filter(
              (item) => !paymentIds.includes(item.id)
            ),
            isLoading: false,
          });
        } catch (error: any) {
          console.error('Failed to hide payments:', error);
          set({
            error: extractErrorMessage(
              error,
              'Не удалось удалить выбранные платежи'
            ),
            isLoading: false,
          });
        }
      },

      /**
       * Создать платёж и открыть окно оплаты
       */
      createPayment: async () => {
        const { selectedTariff } = get();

        if (!selectedTariff) {
          set({ error: 'Тариф не выбран' });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Формируем запрос
          const request: PaymentCreateRequest = {
            payment_type: selectedTariff.type,
          };

          if (selectedTariff.type === 'subscription' && selectedTariff.subscription) {
            request.subscription_type = selectedTariff.subscription;
          } else if (selectedTariff.type === 'credits' && selectedTariff.credits_amount) {
            request.credits_amount = selectedTariff.credits_amount;
          }

          // Создаём платёж
          const response = await createPayment(request);

          set({
            currentPaymentId: response.payment_id,
            isLoading: false,
          });

          // Открываем окно оплаты
          openPaymentWindow(response.confirmation_url);

          // После успешного платежа обновляем профиль
          // (это произойдёт автоматически через webhook и при возврате пользователя)
        } catch (error: any) {
          console.error('Failed to create payment:', error);
          set({
            error: extractErrorMessage(error, 'Не удалось создать платёж'),
            isLoading: false,
          });
        }
      },

      /**
       * Сбросить состояние
       */
      reset: () => {
        set(initialState);
      },

      /**
       * Очистить ошибку
       */
      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'PaymentStore' }
  )
);

/**
 * Hook для использования в компонентах
 */
export const usePayment = () => {
  const store = usePaymentStore();
  const authStore = useAuthStore();

  return {
    ...store,
    user: authStore.user,
    hasCredits: authStore.user ? authStore.user.balance_credits > 0 : false,
    hasActiveSubscription: authStore.user
      ? !!authStore.user.subscription_type &&
        authStore.user.subscription_type !== 'none'
      : false,
  };
};

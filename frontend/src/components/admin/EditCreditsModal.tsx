/**
 * EditCreditsModal - модальное окно для установки нового баланса кредитов пользователю.
 */

import React, { useEffect, useState } from 'react';
import { updateUserCredits } from '../../api/admin';

interface User {
  id: number;
  email: string;
  username?: string;
  balance_credits: number;
}

interface EditCreditsModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditCreditsModal: React.FC<EditCreditsModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [balance, setBalance] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && user) {
      setBalance(String(user.balance_credits ?? 0));
      setReason('');
      setError('');
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedBalance = parseInt(balance, 10);
    if (isNaN(parsedBalance) || parsedBalance < 0) {
      setError('Баланс не может быть отрицательным');
      return;
    }

    const normalizedReason = reason.trim();
    if (normalizedReason && normalizedReason.length < 3) {
      setError('Комментарий должен быть не короче 3 символов');
      return;
    }

    setLoading(true);
    try {
      await updateUserCredits(user.id, {
        new_balance: parsedBalance,
        reason: normalizedReason || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить баланс кредитов');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setBalance(user ? String(user.balance_credits ?? 0) : '');
    setReason('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        ></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                <span className="text-2xl">📝</span>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Редактировать кредиты
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Пользователь: <span className="font-medium">{user.email}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Текущий баланс: <span className="font-medium">{user.balance_credits} кредитов</span>
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="balance" className="block text-sm font-medium text-gray-700">
                  Новый баланс (кредитов)
                </label>
                <input
                  type="number"
                  id="balance"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  min="0"
                  step="1"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Например: 120"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                  Комментарий (опционально)
                </label>
                <input
                  type="text"
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Например: Коррекция после возврата"
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

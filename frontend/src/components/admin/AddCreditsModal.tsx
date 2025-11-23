/**
 * AddCreditsModal - модальное окно для начисления кредитов пользователю
 */

import React, { useState } from 'react';

interface User {
  id: number;
  email: string;
  username?: string;
  balance_credits: number;
}

interface AddCreditsModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCreditsModal: React.FC<AddCreditsModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Сумма должна быть положительным числом');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('auth-storage');
      if (!token) throw new Error('No token');

      const authData = JSON.parse(token);
      const accessToken = authData.state?.token;

      const response = await fetch(
        `http://localhost:8000/api/v1/admin/users/${user.id}/add-credits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            amount: amountNum,
            reason: reason || 'Admin credit adjustment',
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to add credits');
      }

      const data = await response.json();
      console.log('Credits added:', data);

      setAmount('');
      setReason('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось начислить кредиты');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
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
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                <span className="text-2xl">💰</span>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Начислить кредиты
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
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                  Количество кредитов
                </label>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="1"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Например: 100"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                  Причина (опционально)
                </label>
                <input
                  type="text"
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Например: Компенсация за ошибку"
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
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Начисление...' : 'Начислить'}
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

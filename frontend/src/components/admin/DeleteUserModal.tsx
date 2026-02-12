/**
 * DeleteUserModal - модальное окно для удаления пользователя
 */

import React, { useState } from 'react';
import apiClient from '../../api/client';

interface User {
  id: number;
  email: string;
  username?: string;
  role: string;
}

interface DeleteUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DELETE_CONFIRMATION_WORD = 'УДАЛИТЬ';

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [confirmText, setConfirmText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (confirmText !== DELETE_CONFIRMATION_WORD) {
      setError(`Для подтверждения введите ${DELETE_CONFIRMATION_WORD}`);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.delete(
        `/api/v1/admin/users/${user.id}`
      );

      console.log('User deleted:', response.data);

      setConfirmText('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось удалить пользователя');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmText('');
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
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Удалить пользователя
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Вы уверены, что хотите удалить пользователя?
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                    {user.username && (
                      <p className="text-sm text-gray-600">@{user.username}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">ID: {user.id}</p>
                  </div>
                  <div className="mt-3 p-3 bg-red-50 rounded-md border border-red-200">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ Это действие необратимо!
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Будут удалены все данные пользователя: генерации, платежи, рефералы.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
                  Для подтверждения введите <span className="font-mono font-bold">{DELETE_CONFIRMATION_WORD}</span>
                </label>
                <input
                  type="text"
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder={DELETE_CONFIRMATION_WORD}
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
              disabled={loading || confirmText !== DELETE_CONFIRMATION_WORD}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Удаление...' : 'Удалить пользователя'}
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

/**
 * Страница админки.
 *
 * Отображает:
 * - Dashboard: Общую статистику приложения
 * - Users: Управление пользователями (добавление кредитов, назначение админов, удаление)
 *
 * Доступ только для пользователей с ролью ADMIN или SUPER_ADMIN (проверяется через AdminGuard).
 */

import React, { useState } from 'react';
import { AdminGuard } from '../components/guards/AdminGuard';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { UsersManagement } from '../components/admin/UsersManagement';
import { AddCreditsModal } from '../components/admin/AddCreditsModal';
import { DeleteUserModal } from '../components/admin/DeleteUserModal';
import { MakeAdminModal } from '../components/admin/MakeAdminModal';
import { Layout } from '../components/common/Layout';

interface User {
  id: number;
  email: string;
  username?: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  balance_credits: number;
  subscription_type?: string;
  subscription_expires_at?: string;
  created_at: string;
  last_active_at?: string;
}

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users'>('dashboard');

  // Модальные окна
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAddCreditsModalOpen, setIsAddCreditsModalOpen] = useState(false);
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [isMakeAdminModalOpen, setIsMakeAdminModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddCredits = (user: User) => {
    setSelectedUser(user);
    setIsAddCreditsModalOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteUserModalOpen(true);
  };

  const handleMakeAdmin = (user: User) => {
    setSelectedUser(user);
    setIsMakeAdminModalOpen(true);
  };

  const handleSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <AdminGuard>
      <Layout
        title="Админ-панель"
        subtitle="Управление приложением"
        showBalance={false}
        showBackButton={false}
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      >
        {/* Табы */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'dashboard'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'users'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                👥 Users
              </button>
            </nav>
          </div>
        </div>

        {/* Контент */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'users' && (
            <UsersManagement
              key={refreshKey}
              onAddCredits={handleAddCredits}
              onDeleteUser={handleDeleteUser}
              onMakeAdmin={handleMakeAdmin}
            />
          )}
        </div>

        {/* Модальные окна */}
        <AddCreditsModal
          user={selectedUser}
          isOpen={isAddCreditsModalOpen}
          onClose={() => setIsAddCreditsModalOpen(false)}
          onSuccess={handleSuccess}
        />
        <DeleteUserModal
          user={selectedUser}
          isOpen={isDeleteUserModalOpen}
          onClose={() => setIsDeleteUserModalOpen(false)}
          onSuccess={handleSuccess}
        />
        <MakeAdminModal
          isOpen={isMakeAdminModalOpen}
          onClose={() => setIsMakeAdminModalOpen(false)}
          onSuccess={handleSuccess}
        />
      </Layout>
    </AdminGuard>
  );
};

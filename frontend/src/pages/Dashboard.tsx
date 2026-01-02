import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import { FileText, ClipboardList, GraduationCap, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Dashboard() {
  const { user } = useAuthStore();

  const { data: usageStats } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/users/usage`);
      return res.data;
    },
  });

  const quickActions = [
    {
      title: 'Danh sách đề thi',
      description: 'Xem và quản lý các đề thi đã tạo',
      icon: ClipboardList,
      link: '/exams',
      color: 'bg-blue-500',
    },
    {
      title: 'Tạo đề thi',
      description: 'Sử dụng AI để tạo đề thi từ tài liệu',
      icon: ClipboardList,
      link: '/exams/generate',
      color: 'bg-green-500',
    },
    {
      title: 'Ngân hàng câu hỏi',
      description: 'Quản lý câu hỏi của bạn',
      icon: FileText,
      link: '/questions',
      color: 'bg-green-500',
    },
    {
      title: 'Tạo giáo án',
      description: 'Sinh giáo án theo chuẩn Bộ GD&ĐT',
      icon: GraduationCap,
      link: '/lesson-plans',
      color: 'bg-purple-500',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Xin chào, {user?.name}!</h1>
        <p className="text-gray-600 mt-2">Chào mừng bạn đến với EduGenie Teacher</p>
      </div>

      {/* Usage Stats */}
      {usageStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Hạn mức hàng ngày</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {usageStats.daily.used} / {usageStats.daily.limit}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Còn lại: {usageStats.daily.remaining}
                </p>
              </div>
              <TrendingUp className="text-primary-600" size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Hạn mức hàng tháng</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {usageStats.monthly.used} / {usageStats.monthly.limit}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Còn lại: {usageStats.monthly.remaining}
                </p>
              </div>
              <TrendingUp className="text-primary-600" size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gói đăng ký</p>
                <p className="text-2xl font-bold text-primary-600 mt-1">
                  {usageStats.plan.name}
                </p>
                <Link
                  to="/subscription"
                  className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-block"
                >
                  Nâng cấp →
                </Link>
              </div>
              <TrendingUp className="text-primary-600" size={32} />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Thao tác nhanh</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.link}
                to={action.link}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="text-white" size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.title}</h3>
                <p className="text-gray-600 text-sm">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}



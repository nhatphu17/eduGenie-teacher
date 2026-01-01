import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Check, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Subscription() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/plans`);
      return res.data;
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/users/me`);
      return res.data;
    },
  });

  const { mutate: subscribe, isPending } = useMutation({
    mutationFn: async (planName: string) => {
      const res = await axios.post(`${API_URL}/plans/subscribe`, { planName });
      return res.data;
    },
    onSuccess: (data) => {
      // Update user in store
      if (user) {
        setUser({
          ...user,
          subscriptionPlan: data.subscriptionPlan,
        });
      }
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      alert('Đăng ký thành công!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Đăng ký thất bại');
    },
  });

  const currentPlanName = currentUser?.subscriptionPlan?.name || user?.subscriptionPlan?.name;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Gói đăng ký</h1>

      {/* Current Plan Status */}
      {currentPlanName && (
        <div className="card mb-6 bg-primary-50 border-2 border-primary-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-primary-600" size={24} />
            <div>
              <p className="font-semibold text-gray-900">Gói đang sử dụng</p>
              <p className="text-lg font-bold text-primary-600">{currentPlanName}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans?.map((plan: any) => {
          const isCurrentPlan = plan.name === currentPlanName;
          return (
            <div
              key={plan.id}
              className={`card ${isCurrentPlan ? 'ring-2 ring-primary-500' : ''}`}
            >
              {isCurrentPlan && (
                <div className="mb-3 flex items-center gap-2 text-primary-600">
                  <CheckCircle size={20} />
                  <span className="text-sm font-medium">Đang sử dụng</span>
                </div>
              )}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
              <p className="text-3xl font-bold text-primary-600 mb-4">
                {plan.price === 0 ? 'Miễn phí' : `${plan.price.toLocaleString('vi-VN')} đ/tháng`}
              </p>

              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <Check className="text-green-500" size={20} />
                  <span>{plan.dailyQuota} lượt AI/ngày</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-500" size={20} />
                  <span>{plan.monthlyQuota} lượt AI/tháng</span>
                </li>
              </ul>

              <button
                onClick={() => subscribe(plan.name)}
                disabled={isCurrentPlan || isPending}
                className={`w-full btn ${
                  isCurrentPlan ? 'btn-secondary cursor-not-allowed' : 'btn-primary'
                }`}
              >
                {isPending
                  ? 'Đang xử lý...'
                  : isCurrentPlan
                  ? 'Đang sử dụng'
                  : 'Đăng ký'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

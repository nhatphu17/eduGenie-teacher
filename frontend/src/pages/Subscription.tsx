import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Check } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Subscription() {
  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/plans`);
      return res.data;
    },
  });

  const { mutate: subscribe } = useMutation({
    mutationFn: async (planName: string) => {
      const res = await axios.post(`${API_URL}/plans/subscribe`, { planName });
      return res.data;
    },
    onSuccess: () => {
      alert('Đăng ký thành công!');
    },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Gói đăng ký</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans?.map((plan: any) => (
          <div key={plan.id} className="card">
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
              className="w-full btn btn-primary"
            >
              Đăng ký
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


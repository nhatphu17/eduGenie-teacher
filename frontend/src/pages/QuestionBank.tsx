import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Search } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function QuestionBank() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: questions, isLoading } = useQuery({
    queryKey: ['questions'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/questions`);
      return res.data;
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Ngân hàng câu hỏi</h1>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />
          Thêm câu hỏi
        </button>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Tìm kiếm câu hỏi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Đang tải...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions?.map((question: any) => (
            <div key={question.id} className="card">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-gray-900 font-medium mb-2">{question.content}</p>
                  <div className="flex gap-2 text-sm text-gray-500">
                    <span>Lớp {question.grade}</span>
                    <span>•</span>
                    <span>{question.difficulty}</span>
                    <span>•</span>
                    <span>{question.type}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




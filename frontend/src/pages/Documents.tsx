import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Upload, FileText, BookOpen, X, Loader2, Folder, FolderOpen, CheckCircle, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Documents() {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedType, setSelectedType] = useState('TEXTBOOK');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  // Get subjects from API
  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/subjects`);
      return res.data;
    },
  });

  // Get documents grouped by file (folder view)
  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: ['documents', selectedSubject],
    queryFn: async () => {
      if (!selectedSubject) return { grouped: [], total: 0 };
      const res = await axios.get(`${API_URL}/documents`, {
        params: { subjectId: selectedSubject },
      });
      return res.data;
    },
    enabled: !!selectedSubject,
  });

  const uploadSingleMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await axios.post(`${API_URL}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFiles([]);
      alert('Tải lên tài liệu thành công! Embeddings đang được xử lý trong background.');
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || 'Tải lên thất bại');
    },
  });

  const uploadFolderMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await axios.post(`${API_URL}/documents/upload-folder`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000, // 10 minutes for multiple files
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFiles([]);
      alert(`Tải lên thành công ${data.successCount} file(s). ${data.failedCount} file(s) thất bại.`);
    },
    onError: (error: any) => {
      console.error('Upload folder error:', error);
      alert(error.response?.data?.message || 'Tải lên thất bại');
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(
        (file) => file.type.includes('word') || file.type.includes('excel') || file.type === 'text/plain',
      );
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleUpload = async (isFolder: boolean = false) => {
    if (files.length === 0) {
      alert('Vui lòng chọn ít nhất một file');
      return;
    }

    if (!selectedSubject) {
      alert('Vui lòng chọn môn học (folder)');
      return;
    }

    // Check file sizes
    const maxSize = 3 * 1024 * 1024; // 3MB
    const oversizedFiles = files.filter((f) => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      alert(
        `Có ${oversizedFiles.length} file quá lớn (>3MB): ${oversizedFiles.map((f) => f.name).join(', ')}`,
      );
      return;
    }

    const formData = new FormData();
    if (isFolder && files.length > 1) {
      // Upload multiple files
      files.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('type', selectedType);
      formData.append('subjectId', selectedSubject);

      setUploading(true);
      try {
        await uploadFolderMutation.mutateAsync(formData);
      } finally {
        setUploading(false);
      }
    } else {
      // Upload single file
      formData.append('file', files[0]);
      formData.append('type', selectedType);
      formData.append('subjectId', selectedSubject);

      setUploading(true);
      try {
        await uploadSingleMutation.mutateAsync(formData);
      } finally {
        setUploading(false);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const selectedSubjectData = subjects?.find((s: any) => s.id === selectedSubject);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý tài liệu</h1>
          <p className="text-gray-600 mt-2">
            Upload tài liệu vào folder môn học/lớp. AI sẽ đọc tất cả tài liệu trong folder để tạo đề thi và giáo án.
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Tải lên tài liệu vào folder</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn folder (Môn học - Lớp)
            </label>
            {subjectsLoading ? (
              <p className="text-gray-500">Đang tải danh sách môn học...</p>
            ) : (
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setFiles([]);
                }}
                className="input"
              >
                <option value="">Chọn folder môn học</option>
                {subjects?.map((subject: any) => (
                  <option key={subject.id} value={subject.id}>
                    📁 {subject.name} - Lớp {subject.grade}
                  </option>
                ))}
              </select>
            )}
            {selectedSubjectData && (
              <p className="text-sm text-primary-600 mt-2">
                Folder: <strong>{selectedSubjectData.name} - Lớp {selectedSubjectData.grade}</strong>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loại tài liệu</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="input">
              <option value="TEXTBOOK">Sách giáo khoa</option>
              <option value="TEACHER_MATERIAL">Tài liệu giảng dạy</option>
            </select>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Folder className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-700 mb-2">
              Kéo thả file vào đây hoặc{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                chọn file
              </button>
              {' hoặc '}
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                chọn nhiều file
              </button>
            </p>
            <p className="text-sm text-gray-500">Word, Excel, hoặc Text files (tối đa 3MB/file)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              accept=".doc,.docx,.xls,.xlsx,.txt"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Đã chọn {files.length} file(s):
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gray-500" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleUpload(false)}
              disabled={files.length === 0 || !selectedSubject || uploading}
              className="btn btn-primary flex-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Đang tải lên...
                </>
              ) : (
                <>
                  <Upload size={20} className="mr-2" />
                  Tải lên file đầu tiên
                </>
              )}
            </button>
            {files.length > 1 && (
              <button
                onClick={() => handleUpload(true)}
                disabled={!selectedSubject || uploading}
                className="btn btn-primary flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Đang tải lên...
                  </>
                ) : (
                  <>
                    <Folder size={20} className="mr-2" />
                    Tải lên tất cả ({files.length} files)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Documents List - Folder View */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Tài liệu trong folder
          {selectedSubjectData && (
            <span className="text-lg text-primary-600 ml-2">
              {selectedSubjectData.name} - Lớp {selectedSubjectData.grade}
            </span>
          )}
        </h2>

        {!selectedSubject ? (
          <div className="text-center py-12">
            <FolderOpen className="mx-auto text-gray-300 mb-4" size={64} />
            <p className="text-gray-500">Chọn folder môn học để xem tài liệu</p>
          </div>
        ) : documentsLoading ? (
          <p className="text-gray-500 text-center py-8">Đang tải...</p>
        ) : documentsData?.grouped?.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="mx-auto text-gray-300 mb-4" size={64} />
            <p className="text-gray-500 mb-2">Folder trống</p>
            <p className="text-sm text-gray-400">Upload tài liệu để AI có thể sử dụng làm nguồn</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Tổng cộng: <strong>{documentsData?.total}</strong> chunks từ{' '}
              <strong>{documentsData?.grouped?.length}</strong> file(s)
            </div>
            {documentsData?.grouped?.map((group: any, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="text-primary-600" size={24} />
                    <div>
                      <p className="font-medium text-gray-900">{group.fileName}</p>
                      <p className="text-sm text-gray-500">
                        {group.type} • {group.chunks.length} chunk(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.isProcessed ? (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle size={16} />
                        Đã xử lý
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-yellow-600">
                        <Clock size={16} />
                        Đang xử lý
                      </span>
                    )}
                  </div>
                </div>
                {group.chunks.length > 1 && (
                  <div className="ml-8 mt-2 space-y-1">
                    {group.chunks.map((chunk: any) => (
                      <div key={chunk.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText size={14} />
                        <span>Chunk {chunk.chunkIndex + 1}</span>
                        {chunk.isProcessed ? (
                          <CheckCircle size={12} className="text-green-600" />
                        ) : (
                          <Clock size={12} className="text-yellow-600" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

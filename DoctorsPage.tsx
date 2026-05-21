import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { supabase, Doctor } from '../lib/supabase';
import DoctorCard from '../components/ui/DoctorCard';

const specialties = [
  'All Specialties', 'Cardiologist', 'Dentist', 'Neurologist', 'Pediatrician',
  'Orthopedic Surgeon', 'Dermatologist', 'Ophthalmologist', 'Psychiatrist',
  'Internist', 'General Surgeon', 'ENT Specialist', 'Pulmonologist',
];

const locations = [
  'All Locations', 'Al-Ashar', 'Kut Al-Hijaj', 'Margil', 'Jaza\'ir',
  'Abu Al-Khaseeb', 'Al-Bradhiiya', 'Al-Tannuma',
];

export default function DoctorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const query = searchParams.get('q') || '';
  const specialty = searchParams.get('specialty') || '';
  const department = searchParams.get('department') || '';
  const location = searchParams.get('location') || '';

  const [localQuery, setLocalQuery] = useState(query);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('doctors').select('*').eq('is_active', true);

    if (query) q = q.ilike('full_name', `%${query}%`);
    if (specialty && specialty !== 'All Specialties') q = q.ilike('specialty', `%${specialty}%`);
    if (department) q = q.ilike('department', `%${department}%`);
    if (location && location !== 'All Locations') q = q.ilike('location', `%${location}%`);

    const { data } = await q.order('rating', { ascending: false });
    setDoctors(data || []);
    setLoading(false);
  }, [query, specialty, department, location]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = {};
    if (localQuery) params.q = localQuery;
    if (specialty) params.specialty = specialty;
    if (location) params.location = location;
    setSearchParams(params);
  };

  const setFilter = (key: string, value: string) => {
    const params = Object.fromEntries(searchParams);
    if (!value || value.startsWith('All')) {
      delete params[key];
    } else {
      params[key] = value;
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setLocalQuery('');
    setSearchParams({});
  };

  const hasFilters = query || specialty || department || location;

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex-1 flex">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  placeholder="Search doctor name..."
                  className="input-field pl-9"
                />
              </div>
              <button type="submit" className="btn-primary ml-2 px-5 py-2.5 text-sm">
                Search
              </button>
            </form>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                showFilters ? 'bg-primary-50 border-primary-300 text-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasFilters && <span className="w-2 h-2 bg-primary-500 rounded-full" />}
            </button>

            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 px-3 py-2.5">
                <X className="w-4 h-4" /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
              <select
                value={specialty}
                onChange={(e) => setFilter('specialty', e.target.value)}
                className="input-field bg-white"
              >
                {specialties.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select
                value={location}
                onChange={(e) => setFilter('location', e.target.value)}
                className="input-field bg-white"
              >
                {locations.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {department ? `${department} Doctors` : 'All Doctors'}
          </h1>
          <span className="text-sm text-gray-500">{doctors.length} found</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-100" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-100 rounded-full w-3/4" />
                  <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                  <div className="h-3 bg-gray-100 rounded-full w-2/3" />
                  <div className="h-9 bg-gray-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No doctors found</h3>
            <p className="text-gray-500 text-sm mb-4">Try adjusting your search or filters</p>
            <button onClick={clearFilters} className="text-primary-600 font-medium text-sm hover:underline">
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {doctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

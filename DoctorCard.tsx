import { Link } from 'react-router-dom';
import { MapPin, Clock, DollarSign, MessageCircle } from 'lucide-react';
import StarRating from './StarRating';
import { Doctor } from '../../lib/supabase';

export default function DoctorCard({ doctor }: { doctor: Doctor }) {
  const whatsappUrl = `https://wa.me/${doctor.whatsapp.replace(/\D/g, '')}`;

  return (
    <div className="card overflow-hidden group">
      <Link to={`/doctor/${doctor.id}`} className="block relative h-48 overflow-hidden bg-gradient-to-br from-primary-50 to-accent-50">
        <img
          src={doctor.avatar_url || 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=400'}
          alt={doctor.full_name}
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-3 right-3">
          <span className="bg-white/90 backdrop-blur-sm text-primary-600 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
            {doctor.specialty}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
      </Link>

      <div className="p-4">
        <Link to={`/doctor/${doctor.id}`} className="block">
          <h3 className="font-bold text-gray-900 text-base mb-0.5 line-clamp-1 hover:text-primary-600 transition-colors">{doctor.full_name}</h3>
          <p className="text-sm text-primary-600 font-medium mb-2">{doctor.department}</p>
        </Link>

        <div className="flex items-center gap-2 mb-3">
          <StarRating rating={doctor.rating} />
          <span className="text-sm font-semibold text-gray-700">{doctor.rating.toFixed(1)}</span>
          <span className="text-xs text-gray-400">({doctor.review_count})</span>
        </div>

        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="line-clamp-1">{doctor.location}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{doctor.experience_years} years experience</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <DollarSign className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{doctor.consultation_fee.toLocaleString()} IQD / visit</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/book/${doctor.id}`}
            className="btn-primary flex-1 text-xs py-2.5 text-center"
          >
            Book Appointment
          </Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
          <Link
            to={`/map?doctor=${doctor.id}`}
            className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center transition-colors"
            title="View on Map"
          >
            <MapPin className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

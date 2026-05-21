import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, CheckCircle, XCircle, AlertCircle,
  FileText, Settings, Users, Plus, Trash2, Send,
  MessageSquare, Filter
} from 'lucide-react';
import { supabase, Schedule, ScheduleException, Appointment, MedicalRecord } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DAYS_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const statusColors: Record<string, string> = {
  pending: 'badge-pending',
  confirmed: 'badge-confirmed',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
};

type AppointmentWithPatient = Appointment & {
  profiles: { full_name: string; phone: string };
};

export default function DoctorDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [activeTab, setActiveTab] = useState<'appointments' | 'schedule' | 'records'>('appointments');
  const [loading, setLoading] = useState(true);
  const [apptFilter, setApptFilter] = useState<string>('all');

  const [newSched, setNewSched] = useState({ day_of_week: 0, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 });
  const [newException, setNewException] = useState({ date: '', reason: '' });

  const [selectedAppt, setSelectedAppt] = useState<AppointmentWithPatient | null>(null);
  const [recordForm, setRecordForm] = useState({ diagnosis: '', treatment_plan: '', notes: '' });
  const [recordSaving, setRecordSaving] = useState(false);
  const [existingRecord, setExistingRecord] = useState<MedicalRecord | null>(null);

  const loadDoctorId = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('doctors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setDoctorId(data.id);
      loadData(data.id);
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDoctorId();
  }, [loadDoctorId]);

  const loadData = async (dId: string) => {
    const [{ data: appts }, { data: sched }, { data: exc }] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, profiles(full_name, phone)')
        .eq('doctor_id', dId)
        .order('appointment_date', { ascending: false }),
      supabase.from('schedules').select('*').eq('doctor_id', dId).order('day_of_week'),
      supabase.from('schedule_exceptions').select('*').eq('doctor_id', dId).order('exception_date'),
    ]);
    setAppointments((appts as AppointmentWithPatient[]) || []);
    setSchedules(sched || []);
    setExceptions(exc || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (!error) {
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: status as Appointment['status'] } : a));
      const labels: Record<string, string> = { confirmed: 'confirmed', cancelled: 'rejected', completed: 'marked as completed' };
      toast('success', `Appointment ${labels[status] || status}`);
    } else {
      toast('error', 'Failed to update appointment');
    }
  };

  const addSchedule = async () => {
    if (!doctorId) return;
    const exists = schedules.some((s) => s.day_of_week === newSched.day_of_week);
    if (exists) {
      toast('warning', `${DAYS_LABELS[newSched.day_of_week]} already has a schedule. Delete it first.`);
      return;
    }
    const { data, error } = await supabase
      .from('schedules')
      .insert({ ...newSched, doctor_id: doctorId })
      .select()
      .single();
    if (error) { toast('error', 'Failed to add schedule'); return; }
    if (data) {
      setSchedules((prev) => [...prev, data].sort((a, b) => a.day_of_week - b.day_of_week));
      toast('success', `${DAYS_LABELS[newSched.day_of_week]} schedule added`);
    }
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (!error) {
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      toast('success', 'Schedule removed');
    }
  };

  const addException = async () => {
    if (!doctorId || !newException.date) return;
    const { data, error } = await supabase
      .from('schedule_exceptions')
      .insert({ doctor_id: doctorId, exception_date: newException.date, reason: newException.reason })
      .select()
      .single();
    if (error) { toast('error', 'Failed to add off day'); return; }
    if (data) {
      setExceptions((prev) => [...prev, data].sort((a, b) => a.exception_date.localeCompare(b.exception_date)));
      setNewException({ date: '', reason: '' });
      toast('success', 'Off day added');
    }
  };

  const deleteException = async (id: string) => {
    const { error } = await supabase.from('schedule_exceptions').delete().eq('id', id);
    if (!error) {
      setExceptions((prev) => prev.filter((e) => e.id !== id));
      toast('success', 'Off day removed');
    }
  };

  const openRecord = async (appt: AppointmentWithPatient) => {
    setSelectedAppt(appt);
    setRecordForm({ diagnosis: '', treatment_plan: '', notes: '' });
    if (!doctorId) return;
    const { data } = await supabase
      .from('medical_records')
      .select('*')
      .eq('appointment_id', appt.id)
      .maybeSingle();
    if (data) {
      setExistingRecord(data);
      setRecordForm({ diagnosis: data.diagnosis, treatment_plan: data.treatment_plan, notes: data.notes });
    } else {
      setExistingRecord(null);
    }
  };

  const saveRecord = async (sendToPatient: boolean) => {
    if (!selectedAppt || !doctorId) return;
    setRecordSaving(true);

    let error;
    if (existingRecord) {
      ({ error } = await supabase.from('medical_records').update({
        ...recordForm,
        is_sent_to_patient: sendToPatient || existingRecord.is_sent_to_patient,
      }).eq('id', existingRecord.id));
    } else {
      ({ error } = await supabase.from('medical_records').insert({
        appointment_id: selectedAppt.id,
        doctor_id: doctorId,
        patient_id: selectedAppt.patient_id,
        ...recordForm,
        is_sent_to_patient: sendToPatient,
      }));
    }

    if (error) {
      toast('error', 'Failed to save record');
    } else {
      toast('success', sendToPatient ? 'Medical report sent to patient' : 'Draft saved');
      setSelectedAppt(null);
    }
    setRecordSaving(false);
  };

  const pending = appointments.filter((a) => a.status === 'pending');
  const confirmed = appointments.filter((a) => a.status === 'confirmed');
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter((a) =>
    a.appointment_date === today && (a.status === 'pending' || a.status === 'confirmed')
  );

  const filteredAppts = apptFilter === 'all'
    ? appointments
    : appointments.filter((a) => a.status === apptFilter);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-primary-900 rounded-3xl p-6 mb-8 text-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-primary-200 text-sm">Doctor Dashboard</p>
              <h1 className="text-xl font-bold">{profile?.full_name}</h1>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Today's", value: todayAppts.length, icon: Calendar },
              { label: 'Pending', value: pending.length, icon: AlertCircle },
              { label: 'Confirmed', value: confirmed.length, icon: CheckCircle },
              { label: 'Total', value: appointments.length, icon: Users },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center">
                <Icon className="w-5 h-5 mx-auto mb-1 text-white/80" />
                <p className="text-lg font-bold">{value}</p>
                <p className="text-xs text-primary-200">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl border border-gray-100 p-1 mb-6 w-fit flex-wrap gap-1">
          {[
            { key: 'appointments', label: 'Appointments', icon: Calendar },
            { key: 'schedule', label: 'Schedule', icon: Clock },
            { key: 'records', label: 'Medical Records', icon: FileText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as 'appointments' | 'schedule' | 'records')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === key ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse"></div>)}
          </div>
        ) : activeTab === 'appointments' ? (
          <div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Filter:</span>
              {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((s) => (
                <button
                  key={s}
                  onClick={() => setApptFilter(s)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    apptFilter === s ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredAppts.length === 0 ? (
                <div className="text-center py-16 card">
                  <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-600">No appointments found</h3>
                </div>
              ) : (
                filteredAppts.map((appt) => (
                  <div key={appt.id} className="card p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{appt.profiles?.full_name}</p>
                            <p className="text-xs text-gray-400">{appt.profiles?.phone}</p>
                          </div>
                          <span className={statusColors[appt.status]}>
                            {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(appt.appointment_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {appt.appointment_time.substring(0, 5)}
                          </span>
                        </div>
                        {appt.reason && (
                          <p className="text-xs text-gray-400 line-clamp-1">Reason: {appt.reason}</p>
                        )}
                        {appt.notes && (
                          <div className="mt-1.5 bg-primary-50 rounded-lg px-2.5 py-1.5">
                            <p className="text-xs text-primary-700">
                              <span className="font-semibold">Patient notes:</span> {appt.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-50">
                      {appt.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateStatus(appt.id, 'confirmed')}
                            className="flex items-center gap-1 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Confirm
                          </button>
                          <button
                            onClick={() => updateStatus(appt.id, 'cancelled')}
                            className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {appt.status === 'confirmed' && (
                        <button
                          onClick={() => updateStatus(appt.id, 'completed')}
                          className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Mark Complete
                        </button>
                      )}
                      <button
                        onClick={() => { openRecord(appt); setActiveTab('records'); }}
                        className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ml-auto"
                      >
                        <FileText className="w-3.5 h-3.5" /> Medical Record
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'schedule' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600" /> Weekly Schedule
              </h3>

              <div className="grid grid-cols-7 gap-1 mb-5">
                {DAYS_LABELS.map((day, i) => {
                  const sched = schedules.find((s) => s.day_of_week === i);
                  return (
                    <div
                      key={day}
                      className={`rounded-xl p-2 text-center text-xs ${
                        sched ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50 border border-gray-100'
                      }`}
                    >
                      <p className="font-bold text-gray-600 mb-1">{day.substring(0, 3)}</p>
                      {sched ? (
                        <div>
                          <p className="text-primary-700 font-semibold">{sched.start_time.substring(0, 5)}</p>
                          <p className="text-gray-400">to</p>
                          <p className="text-primary-700 font-semibold">{sched.end_time.substring(0, 5)}</p>
                          <p className="text-gray-400 mt-0.5">{sched.slot_duration_minutes}m</p>
                        </div>
                      ) : (
                        <p className="text-gray-300 mt-2">OFF</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 mb-4">
                {schedules.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 text-center">No schedules set yet</p>
                ) : (
                  schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                      <div>
                        <span className="text-sm font-semibold text-gray-700">{DAYS_LABELS[s.day_of_week]}</span>
                        <span className="text-xs text-gray-400 ml-2">{s.start_time.substring(0, 5)} &ndash; {s.end_time.substring(0, 5)}</span>
                        <span className="text-xs text-gray-400 ml-2">({s.slot_duration_minutes}min slots)</span>
                      </div>
                      <button onClick={() => deleteSchedule(s.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500">Add Working Day</p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newSched.day_of_week}
                    onChange={(e) => setNewSched({ ...newSched, day_of_week: Number(e.target.value) })}
                    className="col-span-2 input-field"
                  >
                    {DAYS_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Start</label>
                    <input type="time" value={newSched.start_time} onChange={(e) => setNewSched({ ...newSched, start_time: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">End</label>
                    <input type="time" value={newSched.end_time} onChange={(e) => setNewSched({ ...newSched, end_time: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Slot (min)</label>
                    <select value={newSched.slot_duration_minutes} onChange={(e) => setNewSched({ ...newSched, slot_duration_minutes: Number(e.target.value) })} className="input-field">
                      {[15, 20, 30, 45, 60].map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <button onClick={addSchedule} className="btn-primary flex items-center justify-center gap-1 text-sm py-2">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary-600" /> Off Days / Vacations
              </h3>

              <div className="space-y-2 mb-4">
                {exceptions.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 text-center">No off days set</p>
                ) : (
                  exceptions.map((e) => (
                    <div key={e.id} className="flex items-center justify-between bg-red-50 rounded-xl px-3 py-2">
                      <div>
                        <span className="text-sm font-semibold text-gray-700">
                          {new Date(e.exception_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        {e.reason && <span className="text-xs text-gray-400 ml-2">&ndash; {e.reason}</span>}
                      </div>
                      <button onClick={() => deleteException(e.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500">Add Off Day</p>
                <input type="date" value={newException.date} onChange={(e) => setNewException({ ...newException, date: e.target.value })} className="input-field" />
                <input type="text" value={newException.reason} onChange={(e) => setNewException({ ...newException, reason: e.target.value })} placeholder="Reason (vacation, conference...)" className="input-field" />
                <button onClick={addException} disabled={!newException.date} className="w-full flex items-center justify-center gap-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
                  <Plus className="w-4 h-4" /> Add Off Day
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" /> Select Patient
              </h3>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {appointments.filter((a) => a.status !== 'cancelled').map((appt) => (
                  <button
                    key={appt.id}
                    onClick={() => openRecord(appt)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      selectedAppt?.id === appt.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{appt.profiles?.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(appt.appointment_date).toLocaleDateString()} &middot; {appt.appointment_time.substring(0, 5)}
                      </p>
                      {appt.notes && (
                        <p className="text-xs text-primary-500 line-clamp-1 mt-0.5">
                          <MessageSquare className="w-3 h-3 inline mr-0.5" /> {appt.notes}
                        </p>
                      )}
                    </div>
                    <span className={statusColors[appt.status]}>
                      {appt.status}
                    </span>
                  </button>
                ))}
                {appointments.filter((a) => a.status !== 'cancelled').length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No patients yet</p>
                )}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" /> Medical Case Summary
              </h3>

              {!selectedAppt ? (
                <div className="text-center py-12">
                  <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Select a patient to write a medical record</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-primary-50 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-primary-800 text-sm">{selectedAppt.profiles?.full_name}</p>
                        <p className="text-xs text-primary-600">
                          {new Date(selectedAppt.appointment_date).toLocaleDateString()} &middot; {selectedAppt.appointment_time.substring(0, 5)}
                        </p>
                      </div>
                      {existingRecord && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          existingRecord.is_sent_to_patient
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {existingRecord.is_sent_to_patient ? 'Sent' : 'Draft'}
                        </span>
                      )}
                    </div>
                    {selectedAppt.reason && (
                      <p className="text-xs text-primary-600 mt-1">Reason: {selectedAppt.reason}</p>
                    )}
                    {selectedAppt.notes && (
                      <div className="mt-1.5 bg-white rounded-lg px-2.5 py-1.5">
                        <p className="text-xs text-gray-600">
                          <span className="font-semibold">Patient notes:</span> {selectedAppt.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Diagnosis</label>
                    <textarea value={recordForm.diagnosis} onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })} rows={3} placeholder="Enter diagnosis..." className="input-field resize-none" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Treatment Plan</label>
                    <textarea value={recordForm.treatment_plan} onChange={(e) => setRecordForm({ ...recordForm, treatment_plan: e.target.value })} rows={3} placeholder="Suggested treatment and medications..." className="input-field resize-none" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Notes</label>
                    <textarea value={recordForm.notes} onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })} rows={2} placeholder="Additional medical notes..." className="input-field resize-none" />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => saveRecord(false)} disabled={recordSaving} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                      Save Draft
                    </button>
                    <button onClick={() => saveRecord(true)} disabled={recordSaving} className="btn-primary flex-1 flex items-center justify-center gap-1 py-2.5 text-sm">
                      <Send className="w-3.5 h-3.5" />
                      {recordSaving ? 'Saving...' : 'Send to Patient'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { createSeedState } from "../data/seed";
import { dailyProgress } from "../domain/business";
import { isSupabaseConfigured } from "../integrations/supabase";
import type { AppState, Role } from "../types";
import { canAdmin, initials, Kpi } from "../App";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true" || !isSupabaseConfigured();

export default function PeopleTabBoundary({ state, role, setState, openSheet }: { state: AppState; role: Role; setState: (state: AppState | ((current: AppState) => AppState)) => void; openSheet: (sheet: { title: string; content: React.ReactNode }) => void }) {
  return <Crew state={state} role={role} setState={setState} openSheet={openSheet} />;
}

function CrewMemberSheet({ user, state }: { user: { id: string; name: string; role: Role; color: string; points: number }; state: AppState }) {
  const events = state.pointsEvents.filter(e => e.userId === user.id).slice().reverse().slice(0, 20);
  const streak = state.streaks.find(s => s.userId === user.id);
  const total = user.points + state.pointsEvents.filter(e => e.userId === user.id).reduce((s, e) => s + e.points, 0);
  const progress = dailyProgress(state.truckTasks, state.taskCompletions, user.id);
  return (
    <div>
      <div className="crew-profile">
        <div className="av-xl" style={{ background: user.color }}>{initials(user.name)}</div>
        <div>
          <div className="crew-name">{user.name}</div>
          <div className="tiny muted">{user.role}</div>
        </div>
      </div>
      <div className="kpis" style={{ marginTop: 14 }}>
        <Kpi label="Total points" value={total} sub="all time" />
        <Kpi label="Today" value={`${progress.pct}%`} sub={`${progress.done}/${progress.total} tasks`} />
        <Kpi label="Streak" value={streak?.count ?? 0} sub="day streak" />
        <Kpi label="Events" value={events.length} sub="recent 20" />
      </div>
      {streak && streak.count > 0 && (
        <div className="streak-badge">🔥 {streak.count}-day streak — last award {streak.awardedOn ? new Date(streak.awardedOn).toLocaleDateString('en-CA') : 'none'}</div>
      )}
      <div className="sec-h" style={{ marginTop: 16 }}><h2>Points history</h2></div>
      <section className="card">
        {events.length === 0 && <p className="tiny muted">No points events yet.</p>}
        {events.map(e => (
          <div className="line-item" key={e.id}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{e.reason}</div>
              <div className="tiny muted">{new Date(e.ts).toLocaleDateString('en-CA')}</div>
            </div>
            <span className={`pill ${e.points >= 0 ? 'good' : 'bad'}`}>{e.points > 0 ? '+' : ''}{e.points}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Crew({ state, role, setState, openSheet }: { state: AppState; role: Role; setState: (state: AppState | ((current: AppState) => AppState)) => void; openSheet: (sheet: { title: string; content: React.ReactNode }) => void }) {
  const ranked = state.users.map((user) => ({ ...user, total: user.points + state.pointsEvents.filter((event) => event.userId === user.id).reduce((sum, event) => sum + event.points, 0), progress: dailyProgress(state.truckTasks, state.taskCompletions, user.id).pct })).sort((a, b) => b.total - a.total);
  return <><section className="card">{ranked.map((user, index) => <div className="lb" key={user.id} style={{ cursor: 'pointer' }} onClick={() => openSheet({ title: user.name, content: <CrewMemberSheet user={user} state={state} /> })}><div className={`rank ${index === 0 ? "top" : ""}`}>{index + 1}</div><div className="av-lg" style={{ background: user.color }}>{initials(user.name)}</div><div><b>{user.name}</b><div className="tiny muted">{user.role} · {user.progress}% today</div></div>{(() => {
    const streak = state.streaks.find(s => s.userId === user.id);
    return streak && streak.count >= 2 ? (
      <span className="streak-pill">🔥 {streak.count}</span>
    ) : null;
  })()}<div className="pts"><b>{user.total}</b><div className="tiny muted">points</div></div></div>)}{ranked.length === 0 && <div className="empty-state"><span className="empty-icon">👥</span><div className="empty-msg">No crew members found</div></div>}</section><section className="card"><h3>How points work</h3><p className="tiny muted">Completing 100% of daily truck tasks awards +25 points once per Vancouver workday. Every 5-day streak adds +25. Reversals are append-only events so PEOPLE can audit the ledger.</p></section>{DEMO_MODE && canAdmin(role) && <button className="btn danger block" onClick={() => setState(createSeedState())}>Reset demo data</button>}</>;
}

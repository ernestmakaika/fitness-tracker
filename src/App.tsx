import { useState } from "react";
import { Nav, type Tab } from "./components/Nav";
import { useWorkouts } from "./lib/store";
import { Home } from "./screens/Home";
import { Log, type MicControl } from "./screens/Log";
import { Stats } from "./screens/Stats";
import { Workouts } from "./screens/Workouts";
import { addMinutes, nowTime, today } from "./lib/dates";
import { WorkoutDetail } from "./screens/WorkoutDetail";
import "./screens/screens.css";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [openId, setOpenId] = useState<string | null>(null);
  const [mic, setMic] = useState<MicControl | null>(null);
  const { workouts, add, update, remove } = useWorkouts();

  const open = openId ? workouts.find((w) => w.id === openId) : undefined;

  function go(t: Tab) {
    setOpenId(null);
    setTab(t);
    window.scrollTo(0, 0);
  }

  function openWorkout(id: string | null) {
    setOpenId(id);
    window.scrollTo(0, 0);
  }

  return (
    <div className="app">
      <div className="frame">
        {open ? (
          <WorkoutDetail
            workout={open}
            onBack={() => openWorkout(null)}
            onUpdate={(patch) => update(open.id, patch)}
            onDelete={() => {
              remove(open.id);
              openWorkout(null);
            }}
          />
        ) : tab === "home" ? (
          <Home
            workouts={workouts}
            onOpen={openWorkout}
            onAll={() => go("workouts")}
          />
        ) : tab === "workouts" ? (
          <Workouts workouts={workouts} onOpen={openWorkout} />
        ) : tab === "log" ? (
          <Log
            onSave={(w) =>
              // Logged right after finishing: place it on today's timeline, ending now.
              add(
                !w.startTime && w.date === today()
                  ? { ...w, startTime: addMinutes(nowTime(), -w.durationMin) }
                  : w,
              )
            }
            onDone={() => go("home")}
            registerMic={setMic}
          />
        ) : (
          <Stats workouts={workouts} />
        )}
        {/* A workout is a pushed screen: back button, no tab bar. */}
        {!open && <Nav tab={tab} onChange={go} mic={mic} />}
      </div>
    </div>
  );
}

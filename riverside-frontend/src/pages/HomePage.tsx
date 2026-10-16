import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import type { CampaignRecord, ProgrammeRecord } from "../types";

export default function HomePage() {
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [programmes, setProgrammes] = useState<ProgrammeRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    Promise.all([
      apiGet<{ campaigns: CampaignRecord[] }>("/campaigns"),
      apiGet<{ programmes: ProgrammeRecord[] }>("/programmes"),
    ])
      .then(([campaignResponse, programmeResponse]) => {
        setCampaign(campaignResponse.campaigns[0] ?? null);
        setProgrammes(programmeResponse.programmes.slice(0, 3));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const progress = campaign?.goal_amount
    ? Math.min((campaign.current_amount / campaign.goal_amount) * 100, 100)
    : 0;

  return (
    <div>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-gradient-to-br from-blue-50 to-yellow-50 rounded-3xl p-6 sm:p-8 mb-8">
        <div>
          <p className="uppercase tracking-widest text-blue-700 font-bold text-sm">
            Community support
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-2 mb-4">
            A hub for learning, connection, and care.
          </h1>
          <p className="text-lg leading-relaxed max-w-xl text-gray-700">
            Riverside Community Hub connects members, volunteers, and staff
            through youth programmes, shared resources, and compassionate local
            action.
          </p>

          <div className="flex flex-wrap gap-4 mt-6">
            <Link
              to="/donate"
              className="bg-blue-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-800 transition-colors"
            >
              Donate now
            </Link>
            <Link
              to="/programmes"
              className="bg-white text-blue-900 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
            >
              Explore programmes
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-md">
          <h3 className="font-bold text-xl mb-2">Current campaign</h3>
          {status === "loading" ? <p>Loading campaign...</p> : null}
          {status === "error" ? (
            <p role="alert">Unable to load campaign data.</p>
          ) : null}
          {status === "ready" && !campaign ? (
            <p>No active campaign right now.</p>
          ) : null}
          {campaign ? (
            <>
              <p className="text-3xl font-extrabold mt-1 mb-1">
                R{campaign.current_amount.toLocaleString()}
              </p>
              <p className="text-gray-700">
                Raised so far of R
                {campaign.goal_amount?.toLocaleString() ?? "the campaign goal"}
              </p>
              <div className="h-3 rounded-full bg-gray-200 overflow-hidden mt-4 mb-2">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{Math.round(progress)}% funded</span>
                <span>
                  Goal: R{campaign.goal_amount?.toLocaleString() ?? "TBC"}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Featured programmes</h2>
          <Link
            to="/programmes"
            className="text-blue-700 font-bold hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programmes.map((programme) => (
            <article
              key={programme.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm"
            >
              <img
                src={
                  programme.image_url ??
                  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80"
                }
                alt={programme.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <p className="text-blue-700 font-bold text-sm">
                  {programme.age_range ?? "All ages"}
                </p>
                <h3 className="font-bold text-lg mt-1 mb-1">{programme.title}</h3>
                <p className="text-gray-700 min-h-[60px] text-sm leading-relaxed">
                  {programme.description}
                </p>
                <small className="block mt-2 text-gray-600 text-sm">
                  {programme.schedule_info ?? "Schedule to be confirmed"}
                </small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}


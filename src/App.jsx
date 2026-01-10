import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import "./App.css";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";

function getYearFromDateAdded(dateAdded) {
  if (!dateAdded) return null;
  const d = new Date(dateAdded);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
}

export default function App() {
  // -----------------------
  // STATE (top-level only)
  // -----------------------
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentType, setContentType] = useState("All");
  const [minYear, setMinYear] = useState(2015);
  const [activeGenre, setActiveGenre] = useState(null);



  // -----------------------
  // LOAD CSV (top-level hook)
  // -----------------------
  useEffect(() => {
    fetch("/netflix_titles.csv")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching CSV`);
        return res.text();
      })
      .then((csvText) => {
        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        });
        setRows(parsed.data);
        console.log("ROWS:", parsed.data.slice(0, 5));
      })
      .catch((err) => {
        console.error("Failed to load CSV:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // -----------------------
  // CHART 1 DATA: titles added per year (with filter)
  // -----------------------
  const titlesAddedByYear = useMemo(() => {
    const counts = new Map();

    for (const r of rows) {
      if (contentType !== "All" && r.type !== contentType) continue;

      const year = getYearFromDateAdded(r.date_added);
      if (!year) continue;

      counts.set(year, (counts.get(year) ?? 0) + 1);
    }

    const result = Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, titles]) => ({ year, titles }));

    console.log("TITLES BY YEAR:", result.slice(0, 5));
    return result;
  }, [rows, contentType]);

  // -----------------------
  // CHART 2 DATA: movies vs tv shows by year (no filter)
  // -----------------------
  const moviesVsTvByYear = useMemo(() => {
    const counts = new Map();

    for (const r of rows) {
      const year = getYearFromDateAdded(r.date_added);
      if (!year) continue;

      if (!counts.has(year)) counts.set(year, { year, Movie: 0, "TV Show": 0 });

      if (r.type === "Movie" || r.type === "TV Show") {
        counts.get(year)[r.type] += 1;
      }
    }

    return Array.from(counts.values()).sort((a, b) => a.year - b.year);
  }, [rows]);

  // -----------------------
  // CHART 3 DATA: Genre Mix Over Time (stacked)
  // -----------------------
  const TOP_GENRES = 8;

  const genreMixByYear = useMemo(() => {
    // 1) Count genres overall to find "top genres"
    const genreTotals = new Map();

    for (const r of rows) {
      if (!r.listed_in) continue;

      const genres = r.listed_in.split(",").map((g) => g.trim()).filter(Boolean);
      for (const g of genres) {
        genreTotals.set(g, (genreTotals.get(g) ?? 0) + 1);
      }
    }

    const topGenres = Array.from(genreTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_GENRES)
      .map(([g]) => g);

    // 2) Build year → { year, genre1: count, genre2: count, Other: count }
    const byYear = new Map();

    for (const r of rows) {
      const year = getYearFromDateAdded(r.date_added);
      if (!year) continue;

      if (!byYear.has(year)) {
        const base = { year };
        for (const g of topGenres) base[g] = 0;
        base.Other = 0;
        byYear.set(year, base);
      }

      const target = byYear.get(year);

      const genres = (r.listed_in || "")
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);

      for (const g of genres) {
        if (topGenres.includes(g)) target[g] += 1;
        else target.Other += 1;
      }
    }

    const result = Array.from(byYear.values()).sort((a, b) => a.year - b.year);
    return { result, topGenres };
  }, [rows]);

  // -----------------------
  // UI
  // -----------------------
  const formatNumber = (n) => (n == null ? "" : Number(n).toLocaleString());
  const GENRE_COLORS = {
  "Dramas": "#4C78A8",
  "Comedies": "#F58518",
  "Documentaries": "#54A24B",
  "Action & Adventure": "#E45756",
  "International Movies": "#72B7B2",
  "International TV Shows": "#B279A2",
  "Independent Movies": "#FF9DA6",
  "TV Dramas": "#9D755D",
  "Other": "#BAB0AC",
};
const isGenreActive = (g) => !activeGenre || activeGenre === g;

const areaOpacity = (g) => (isGenreActive(g) ? 0.85 : 0.15);
const strokeOpacity = (g) => (isGenreActive(g) ? 1 : 0.2);


  return (
<div
  style={{
    padding: 24,
    maxWidth: 980,
    margin: "0 auto",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  }}
>
    <h1 style={{ marginBottom: 6 }}>Netflix Catalog Growth</h1>
    <p style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.5 }}>
  A lightweight dashboard exploring how Netflix’s catalog has evolved over time. 
  Showing overall growth, the balance of Movies vs TV Shows, and shifting genre mix.
</p>
    


    <div style={{ margin: "12px 0 18px", display: "flex", gap: 10, alignItems: "center" }}>
      <label style={{ fontWeight: 600 }}>Type</label>
      <select
        value={contentType}
        onChange={(e) => setContentType(e.target.value)}
        style={{ padding: "6px 10px", borderRadius: 8 }}
      >
        <option value="All">All</option>
        <option value="Movie">Movie</option>
        <option value="TV Show">TV Show</option>
      </select>
    </div>

    {loading ? (
      <p>Loading dataset…</p>
    ) : titlesAddedByYear.length === 0 ? (
      <p>
        No rows were parsed. Double-check that <code>public/netflix_titles.csv</code>{" "}
        exists and includes a <code>date_added</code> column.
      </p>
    ) : (
      <>
        {/* CHART 1 */}
        <h2 style={{ marginBottom: 6 }}>Titles Added Per Year</h2>
        <p style={{ marginTop: 0, marginBottom: 6, fontStyle: "italic", opacity: 0.75 }}>
  How quickly has Netflix’s catalog expanded over time?
</p>
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          Growth of Netflix’s catalog over time.
        </p>

        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={titlesAddedByYear}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={formatNumber} />
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Line type="monotone" dataKey="titles" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CHART 2 */}
        <h2 style={{ marginTop: 40, marginBottom: 6 }}>
          Movies vs TV Shows Over Time
        </h2>
        <p style={{ marginTop: 0, marginBottom: 6, fontStyle: "italic", opacity: 0.75 }}>
  How has Netflix balanced Movies vs TV Shows as the platform scaled?
</p>

        <p style={{ marginTop: 0, opacity: 0.8 }}>
          Comparison of catalog growth by content type.
        </p>

        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={moviesVsTvByYear}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={formatNumber} />
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Legend />
              <Line type="monotone" dataKey="Movie" stroke="#E50914" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="TV Show" stroke="#1F77B4" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CHART 3 */}
        <div style={{ margin: "10px 0 14px", display: "flex", gap: 10, alignItems: "center" }}>
  <label style={{ fontWeight: 600 }}>From year</label>
  <select
    value={minYear}
    onChange={(e) => setMinYear(Number(e.target.value))}
    style={{ padding: "6px 10px", borderRadius: 8 }}
  >
    {[2008, 2010, 2012, 2014, 2015, 2016, 2017, 2018, 2019].map((y) => (
      <option key={y} value={y}>{y}+</option>
    ))}
  </select>
</div>
        <h2 style={{ marginTop: 40, marginBottom: 6 }}>
          Genre Mix Over Time
        </h2>
        <p style={{ marginTop: 0, marginBottom: 6, fontStyle: "italic", opacity: 0.75 }}>
  How has the composition of Netflix’s content shifted by genre over time?
</p>

        <p style={{ marginTop: 0, marginBottom: 6, opacity: 0.8 }}>
          Catalog additions by year, segmented by genre.
        </p>
        <p style={{ marginTop: 0, fontSize: 12, opacity: 0.6 }}>
  Hover over a genre in the legend to isolate it.
</p>


        {genreMixByYear?.result?.length > 0 ? (
          <div style={{ width: "100%", height: 420, minHeight: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={genreMixByYear.result.filter(d => d.year >= minYear)}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Legend
  onMouseEnter={(e) => {
    // e.value is the legend label (the genre name)
    if (e && e.value) setActiveGenre(e.value);
  }}
  onMouseLeave={() => setActiveGenre(null)}
/>


                {genreMixByYear.topGenres.map((g) => (
  <Area
    key={g}
    type="monotone"
    dataKey={g}
    stackId="1"
    stroke={GENRE_COLORS[g] || "#8884d8"}
    fill={GENRE_COLORS[g] || "#8884d8"}
    fillOpacity={areaOpacity(g)}
    strokeOpacity={strokeOpacity(g)}
    isAnimationActive={false}
    onMouseEnter={() => setActiveGenre(g)}
onMouseLeave={() => setActiveGenre(null)}

  />
))}

<Area
  type="monotone"
  dataKey="Other"
  stackId="1"
  stroke={GENRE_COLORS.Other}
  fill={GENRE_COLORS.Other}
  fillOpacity={areaOpacity("Other")}
  strokeOpacity={strokeOpacity("Other")}
  isAnimationActive={false}
  onMouseEnter={() => setActiveGenre(g)}
onMouseLeave={() => setActiveGenre(null)}

/>

              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p style={{ opacity: 0.75 }}>
            Genre chart will appear once <code>listed_in</code> values are parsed.
          </p>
        )}

        <p style={{ marginTop: 16, opacity: 0.75 }}>
          Rows loaded: <b>{rows.length}</b>
        </p>
      </>
    )}
 <p style={{ marginTop: "auto", fontSize: 12, opacity: 0.55 }}>
  Data source:{" "}
  <a
    href="https://www.kaggle.com/datasets/shivamb/netflix-shows"
    target="_blank"
    rel="noreferrer"
    style={{ color: "inherit" }}
  >
    Netflix Movies and TV Shows (Kaggle)
  </a>
</p>

  </div>
  

);
}

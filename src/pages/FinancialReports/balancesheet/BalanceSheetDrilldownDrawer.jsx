// src/components/Reports/BalanceSheet/BalanceSheetDrilldownDrawer.jsx

import React, { useEffect, useState } from "react";
import DrilldownDrawer, { DrilldownBodySkeleton, DrilldownFadeIn, DrilldownSummarySkeleton } from "../DrilldownDrawer";
import { FiX, FiChevronRight, FiChevronDown } from "react-icons/fi";
import { cachedFetch } from "../../../utils/reportCache";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";
import { getDecimalPrecision } from '../../../utils/formatters';

const parseValue = (v) => {
  if (!v) return 0;
  const num = parseFloat(v.replace(/[^0-9.-]+/g, ""));
  return v.includes("K") ? num * 1000 : num;
};

export default function BalanceSheetDrilldownDrawer({
  open,
  onClose,
  token,
  accountName,
  currency = "USD",
  API_BASE_URL
}) {

  const [data,setData] = useState(null)
  const [loading,setLoading] = useState(false)
  const [tab,setTab] = useState("summary")
  const [expanded,setExpanded] = useState({})

  useEffect(()=>{

    if(!open || !accountName) return

    // Clear the previous account so its figures don't show under the new one.
    setData(null)
    setLoading(true)
    cachedFetch(
      `${API_BASE_URL}/api/v1/company/financial/balance-sheet-drilldown/${encodeURIComponent(accountName)}/${currency}?currency_filter=thousands`,
      {
        headers:{
          Authorization:`Bearer ${token}`,
          accept:"application/json"
        }
      }
    )
      .then(setData)
      .catch(console.error)
      .finally(()=>setLoading(false))

  },[open,accountName,currency,token,API_BASE_URL])

  const toggle=(k)=>setExpanded(p=>({...p,[k]:!p[k]}))

  /* ---------------- TREE RENDER ---------------- */

  const renderRows=(rows,level=0,parent="")=>{

    if(!Array.isArray(rows)) return null

    return rows.map((r,i)=>{

      const key=`${parent}-${i}`
      const open=expanded[key]

      const children=r.by_entity_by_account_type || r.children

      return(

        <React.Fragment key={key}>

<tr
className="border-b hover:bg-sky-50 cursor-pointer"
onClick={()=>children && toggle(key)}
>

<td className="p-3 flex items-center gap-2">

<div style={{marginLeft:level*20}}>
{children && (
open ? <FiChevronDown/> : <FiChevronRight/>
)}
</div>

{r.entity_name || r.account_type}

</td>

<td className="text-right p-3">{r.current_balance}</td>
<td className="text-right p-3">{r.previous_balance}</td>

<td className={`text-right p-3 ${
r.trend==="up"
?"text-green-600"
:"text-red-600"
}`}>
{r.change}
</td>

<td className="text-right p-3">
{r.change_pct?.toFixed(getDecimalPrecision())}%
</td>

</tr>

{children && open && renderRows(children,level+1,key)}

</React.Fragment>

)

})

}

const chartData =
data?.performance_flow?.map(i=>({
label:i.label,
value:parseValue(i.value),
type:i.type
})) || []

return(

<DrilldownDrawer open={open} onClose={onClose} className="w-[1200px] max-w-[75vw]">

{/* HEADER */}

<div className="px-8 py-6 bg-gradient-to-r from-sky-900 to-sky-700 text-white">

<div className="flex justify-between">

<div>

<h2 className="text-2xl font-bold">
{data?.title}
</h2>

<p className="text-sky-200 mt-1">
{data?.subtitle}
</p>

{loading ? <DrilldownSummarySkeleton/> : (
<div className="grid grid-cols-4 gap-6 mt-6">

<SummaryCard
label="Current Balance"
value={data?.summary?.current_balance}
/>

<SummaryCard
label="Previous Balance"
value={data?.summary?.previous_balance}
/>

<SummaryCard
label="Variance"
value={data?.summary?.variance}
/>

<SummaryCard
label="% Change"
value={`${data?.summary?.pct}%`}
/>

</div>
)}

</div>

<button onClick={onClose}>
<FiX size={22}/>
</button>

</div>

</div>

{/* TABS */}

<div className="flex border-b bg-white">

{["summary","insights","flow","breakdown","recommendations"].map(t=>(
<button
key={t}
onClick={()=>setTab(t)}
className={`px-6 py-3 text-s font-medium ${
tab===t
?"border-b-2 border-sky-800 text-sky-900"
:"text-sky-600"
}`}
>
{t.toUpperCase()}
</button>
))}

</div>

<div className="flex-1 overflow-auto p-8">

{loading ? <DrilldownBodySkeleton/> : (
<DrilldownFadeIn key={tab}>

{/* SUMMARY */}

{tab==="summary" && (

<Card title="Summary">

<div className="grid grid-cols-2 gap-4 text-s">

<div>Current Period: {data?.summary?.current_period}</div>
<div>Previous Period: {data?.summary?.previous_period}</div>

<div>Current Balance: {data?.summary?.current_balance}</div>
<div>Previous Balance: {data?.summary?.previous_balance}</div>

<div>Variance: {data?.summary?.variance}</div>
<div>% Change: {data?.summary?.pct}%</div>

</div>

</Card>

)}

{/* INSIGHTS */}

{tab==="insights" && (

<Card title="Insights">

<p className="text-s text-sky-900 mb-4">
{data?.insights?.summary}
</p>

<div className="space-y-3">

{data?.insights?.sumary?.map((d,i)=>(
<div
key={i}
className="flex justify-between bg-sky-50 p-3 rounded"
>

<div>

<div className="font-medium">
{d.description}
</div>

<div className="text-x text-gray-500">
{d.detail}
</div>

</div>

<div className="font-semibold">
{d.amount}
</div>

</div>
))}

</div>

</Card>

)}

{/* FLOW */}

{tab==="flow" && (

<div className="grid grid-cols-2 gap-8">

<Card title="Performance Flow">

{data?.performance_flow?.map((f,i)=>(
<div
key={i}
className="flex justify-between border-b py-2"
>

<div>
<div className="font-medium">
{f.label}
</div>
<div className="text-x text-gray-500">
{f.description}
</div>
</div>

<div className="font-semibold">
{f.value}
</div>

</div>
))}

</Card>

<Card title="Flow Chart">

<ResponsiveContainer width="100%" height={400}>

<BarChart data={chartData}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="label"/>

<YAxis/>

<Tooltip/>

<Bar dataKey="value">

{chartData.map((e,i)=>(
<Cell
key={i}
fill={
e.type==="positive"
?"#16a34a"
:e.type==="negative"
?"#dc2626"
:"#0369a1"
}
/>
))}

</Bar>

</BarChart>

</ResponsiveContainer>

</Card>

</div>

)}

{/* BREAKDOWN */}

{tab==="breakdown" && (

<Card title="Entity Breakdown">

<table className="w-full text-s">

<thead className="bg-sky-100">
<tr>
<th className="p-3 text-left">Entity</th>
<th className="p-3 text-right">Current</th>
<th className="p-3 text-right">Previous</th>
<th className="p-3 text-right">Change</th>
<th className="p-3 text-right">% Change</th>
</tr>
</thead>

<tbody>

{renderRows(data?.breakdowns)}

</tbody>

</table>

</Card>

)}

{/* RECOMMENDATIONS */}

{tab==="recommendations" && (

<Card title="Recommendations">

<ul className="list-disc pl-5 space-y-2 text-s">

{data?.insights?.recommendations?.map((r,i)=>(
<li key={i}>{r}</li>
))}

</ul>

</Card>

)}

</DrilldownFadeIn>
)}

</div>

</DrilldownDrawer>

)

}

/* UI */

const Card=({title,children})=>(
<div className="bg-white p-6 rounded-xl shadow">
<h3 className="font-semibold text-sky-800 mb-4">{title}</h3>
{children}
</div>
)

const SummaryCard=({label,value})=>(
<div>
<div className="text-sky-200 text-s">{label}</div>
<div className="font-bold text-lg">{value}</div>
</div>
)
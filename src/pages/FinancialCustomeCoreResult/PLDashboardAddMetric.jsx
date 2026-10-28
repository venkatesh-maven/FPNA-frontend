import React, { useState, useRef, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiPlus, FiX, FiCheck, FiLoader, FiTag } from "react-icons/fi";
import { BsThreeDotsVertical } from "react-icons/bs";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";

export default function AddMetricButton({
    accountName = "",
    currencyFilter = "actualvalue",
    onSuccess,
}) {
    const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

    const [open, setOpen] = useState(false);
    const [metricName, setMetricName] = useState("");
    const [status, setStatus] = useState("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const inputRef = useRef(null);

    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 120);
        }
    }, [open]);

    const handleClose = () => {
        setOpen(false);
        setMetricName("");
        setStatus("idle");
        setErrorMsg("");
    };

    const handleSubmit = async () => {
        if (!metricName.trim()) {
            setErrorMsg("Please enter a metric name.");
            return;
        }

        setStatus("loading");

        try {
            const params = new URLSearchParams({
                metric_name: metricName.trim(),
                account_name: accountName,
                currency_filter: currencyFilter,
            });

            const res = await fetch(
                `${API_BASE_URL}/api/v1/company/financial/metric/add/${selectedYear}/${selectedCurrency}?${params}`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.detail || err?.message || "API Error");
            }

            const data = await res.json().catch(() => ({}));

            setStatus("success");
            onSuccess?.(data);

            setTimeout(() => handleClose(), 1500);
        } catch (err) {
            setStatus("error");
            setErrorMsg(err.message || "Something went wrong");
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSubmit();
        if (e.key === "Escape") handleClose();
    };

    return (
        <>
            {/* BUTTON WITH TOOLTIP */}
            <div className="relative group inline-block">
                <div className="relative group inline-block">
                    <button
                        onClick={() => setOpen(true)}
                        className="p-1 text-sky-900 rounded-sm hover:text-sky-900 bg-sky-100 transition"
                    >
                        <BsThreeDotsVertical size={13} />
                    </button>

                    {/* Tooltip */}
                    <div
                        className="absolute left-3 top-0 -translate-x-1/2
          bg-sky-900 text-white text-[10px] px-2 py-1 rounded
          opacity-0 group-hover:opacity-100 transition
          pointer-events-none whitespace-nowrap"
                    >
                        Add Metric
                    </div>
                </div>


                {/* MODAL */}
                <AnimatePresence>
                    {open && (
                        <>
                            {/* BACKDROP */}
                            <motion.div
                                className="absolute px-10  z-40"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={handleClose}
                            />

                            {/* MODAL BOX */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-[420px]  bg-white rounded-xl border border-sky-200
              shadow-2xl z-50 overflow-hidden"
                            >
                                {/* HEADER */}
                                <div className="flex items-center text-white justify-between px-2 py-3 bg-sky-900">
                                    New Metric

                                    <button
                                        onClick={handleClose}
                                        className="text-white/70 hover:text-white"
                                    >
                                        <FiX size={14} />
                                    </button>
                                </div>

                                {/* BODY */}
                                <div className="px-4 py-4 space-y-5">
                                    <div>
                                        <p className="text-md font-semibold  text-sky-900 mb-5 uppercase ">
                                            <span className="text-md font-bold underline">{accountName ? ` "${accountName}"` : ""}</span> Metric will be added in dashboard
                                        </p>
                                        <label className="flex items-center gap-1  text-[11p] font-bold text-sky-900 uppercase mb-2">
                                            <FiTag size={10} />
                                            Metric Name
                                        </label>

                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={metricName}
                                            onChange={(e) => setMetricName(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="e.g. Q4 Gross Margin"
                                            disabled={status === "loading"}
                                            className="w-full mt-1 px-3 py-2 text-x border border-sky-200
                    rounded-lg focus:ring-2 focus:ring-sky-400 outline-none"
                                        />
                                    </div>

                                    {errorMsg && (
                                        <p className=" text-[11p] text-red-500">{errorMsg}</p>
                                    )}

                                    {status === "success" && (
                                        <div className="flex items-center gap-2  text-[11p] text-emerald-600 font-semibold">
                                            <FiCheck size={12} />
                                            Metric added successfully
                                        </div>
                                    )}
                                </div>

                                {/* FOOTER */}
                                {status !== "success" && (
                                    <div className="flex gap-2 px-4 pb-4">
                                        <button
                                            onClick={handleClose}
                                            className="flex-1 text-x border border-sky-200 py-2 rounded-lg
                    hover:bg-sky-50"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            onClick={handleSubmit}
                                            disabled={!metricName.trim() || status === "loading"}
                                            className="flex-1 flex items-center justify-center gap-1
                    text-x text-white bg-sky-900 py-2 rounded-lg
                    hover:bg-sky-700"
                                        >
                                            {status === "loading" ? (
                                                <>
                                                    <FiLoader className="animate-spin" size={12} />
                                                    Adding
                                                </>
                                            ) : (
                                                <>
                                                    <FiPlus size={12} />
                                                    Add Metric
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

            </div>
        </>


    );
}
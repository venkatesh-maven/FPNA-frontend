import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FiDownload, FiEdit3, FiCheck, FiX, FiChevronRight, FiPlus, FiTrash2, FiInfo } from "react-icons/fi";
import { motion } from "framer-motion";

// --- Expert-Level Mock Data: Multiple, practical rules per department ---
const initialData = {
	sales: {
		department: "Sales",
		rules: [
			{ id: 1, target: "T&E Spend Growth", value: "< 15% YoY", notes: "Travel must align with revenue plan; trips > ₹1L need pre-approval." },
			{ id: 2, target: "New Headcount (AEs)", value: "5 FTEs", notes: "Hiring to be phased-in starting H2, post-performance review." },
            { id: 3, target: "SaaS Tools (CRM, etc.)", value: "< 5% growth", notes: "No new tools without validating non-overlap with existing stack." },
		]
	},
	marketing: {
		department: "Marketing",
		rules: [
			{ id: 4, target: "Digital Ad Spend", value: "Flat vs. LY", notes: "Increases only for campaigns with a documented ROI > 3:1." },
            { id: 5, target: "Events & Conferences", value: "Limit to 3 Tier-1 events", notes: "Focus on lead-generating events, reduce branding-only presence." },
			{ id: 6, target: "Contractor Spend", value: "-10% vs LY", notes: "Prioritize in-house content creation over external agencies." },
		]
	},
	it: {
		department: "IT",
		rules: [
			{ id: 7, target: "Cloud Infrastructure (AWS/GCP)", value: "-10% cost/user", notes: "Aggressively pursue reserved instances and savings plans." },
			{ id: 8, target: "SaaS Renewals", value: "< 5% price increase", notes: "All contracts > ₹15L must be reviewed by procurement." },
			{ id: 9, target: "New Laptops/Hardware", value: "Per new hire only", notes: "Standardize on M2 MacBook Airs; exceptions need CIO approval." },
		]
	},
    hr: {
		department: "HR & People",
		rules: [
			{ id: 10, target: "Annual Salary Inflation Pool", value: "4.5%", notes: "Merit-based; not an automatic cost-of-living adjustment." },
			{ id: 11, target: "Recruitment Agency Fees", value: "< 15% of salary", notes: "Prioritize direct sourcing and employee referrals." },
		]
	},
};

const cardVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
};

const statusColors = {
	Published: "bg-green-100 text-green-800",
};

const AddDepartmentModal = ({ onAdd, onCancel }) => {
    const [deptName, setDeptName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (deptName.trim()) {
            onAdd(deptName.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-lg font-semibold text-sky-900 mb-4">Add New Department</h3>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="deptName" className="block text-s font-medium text-gray-700">Department Name</label>
                    <input
                        id="deptName"
                        type="text"
                        value={deptName}
                        onChange={(e) => setDeptName(e.target.value)}
                        className="mt-1 w-full p-2 border-gray-300 border rounded-md text-s"
                        placeholder="e.g., Product Development"
                        autoFocus
                    />
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-s font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 text-s font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50" disabled={!deptName.trim()}>
                            Add Department
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CorporateBudgetGuidelines = () => {
	const [guidelines, setGuidelines] = useState(JSON.parse(JSON.stringify(initialData)));
	const [editingRuleId, setEditingRuleId] = useState(null);
	const [tempData, setTempData] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

	const startEditing = (rule) => {
		setEditingRuleId(rule.id);
		setTempData(rule);
	};

	const cancelEditing = () => {
		setEditingRuleId(null);
		setTempData(null);
	};

    const handleTempChange = (field, value) => {
		setTempData((prev) => ({ ...prev, [field]: value }));
	};

	const saveEditing = (deptKey) => {
		setGuidelines(prev => {
            const newDeptRules = prev[deptKey].rules.map(rule => 
                rule.id === editingRuleId ? tempData : rule
            );
            return { ...prev, [deptKey]: { ...prev[deptKey], rules: newDeptRules } };
        });
		setEditingRuleId(null);
		setTempData(null);
	};

    const addRule = (deptKey) => {
        const newRule = { id: Date.now(), target: "", value: "", notes: "" };
        setGuidelines(prev => ({
            ...prev,
            [deptKey]: {
                ...prev[deptKey],
                rules: [...prev[deptKey].rules, newRule]
            }
        }));
        startEditing(newRule);
    };

    const deleteRule = (deptKey, ruleId) => {
        if (window.confirm('Are you sure you want to delete this guideline? This action cannot be undone.')) {
            setGuidelines(prev => ({
                ...prev,
                [deptKey]: {
                    ...prev[deptKey],
                    rules: prev[deptKey].rules.filter(rule => rule.id !== ruleId)
                }
            }));
        }
    };

    const handleAddDepartment = (deptName) => {
        const deptKey = deptName.toLowerCase().replace(/\s+/g, '');
        if (guidelines[deptKey]) {
            alert('A department with this name already exists.');
            return;
        }
        setGuidelines(prev => ({
            ...prev,
            [deptKey]: {
                department: deptName,
                rules: []
            }
        }));
        setIsModalOpen(false);
    };

	return (
		<div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
            {isModalOpen && <AddDepartmentModal onAdd={handleAddDepartment} onCancel={() => setIsModalOpen(false)} />}
			
            {/* Breadcrumb & Header */}
			<motion.div initial="hidden" animate="visible" variants={cardVariants}>
				<nav className="flex mb-4" aria-label="Breadcrumb">
					<ol className="inline-flex items-center space-x-1 md:space-x-2">
						<li><Link to="/budgeting-hub" className="text-s font-medium text-gray-700 hover:text-blue-600">Budgeting Hub</Link></li>
						<li><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><span className="text-s font-medium text-gray-500">Corporate Guidelines</span></div></li>
					</ol>
				</nav>
				<div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md">
					<div className="flex flex-col md:flex-row justify-between items-start md:items-center">
						<div>
							<h1 className="text-xl font-bold text-white">Corporate Budget Guidelines</h1>
							<p className="text-sky-100 text-s mt-1">Define top-down targets to guide the annual financial planning process.</p>
						</div>
						<div className="flex items-center space-x-2 mt-3 md:mt-0">
							<button onClick={() => window.print()} className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-700 rounded-lg border border-sky-600 hover:bg-sky-600"><FiDownload className="mr-1.5" /> Export View</button>
						</div>
					</div>
				</div>
			</motion.div>

			{/* Version & Status Header */}
			{/* <motion.div initial="hidden" animate="visible" variants={cardVariants} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center space-x-4 text-x text-gray-500">
						<span className={`px-2 py-1 rounded-full font-medium ${statusColors["Published"]}`}>Status: Published</span>
						<span className="font-medium">Version: <span className="font-semibold text-gray-800">FY25 Guidance v1</span></span>
						<span>Issued: <span className="font-semibold text-gray-800">March 15, 2025</span></span>
					</div>
				</div>
			</motion.div> */}

			{/* Guidelines Editor */}
			<motion.div initial="hidden" animate="visible" variants={cardVariants} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-sky-800">FY2025 Planning Guidelines</h2>
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center text-s font-medium text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg transition-colors">
                        <FiPlus size={16} className="mr-2"/> Add Department
                    </button>
                </div>
                <div className="space-y-8">
                    {Object.keys(guidelines).map(deptKey => {
                        const dept = guidelines[deptKey];
                        return (
                            <div key={deptKey}>
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                                    <h3 className="font-bold text-md text-sky-900">{dept.department}</h3>
                                    <button onClick={() => addRule(deptKey)} className="flex items-center text-s font-medium text-sky-600 hover:text-sky-800 px-3 py-1 rounded-md hover:bg-sky-100 transition-colors">
                                        <FiPlus size={14} className="mr-1"/> Add Guideline
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full mx-auto">
                                        <thead className="bg-sky-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-x font-semibold text-sky-700 uppercase tracking-wider w-1/4">Guideline Target</th>
                                                <th className="px-4 py-2 text-left text-x font-semibold text-sky-700 uppercase tracking-wider w-1/5">Value</th>
                                                <th className="px-4 py-2 text-left text-x font-semibold text-sky-700 uppercase tracking-wider w-2/5">Notes / Rationale</th>
                                                <th className="px-4 py-2 text-center text-x font-semibold text-sky-700 uppercase tracking-wider w-[15%]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {dept.rules.map(rule => {
                                                const isEditing = editingRuleId === rule.id;
                                                return (
                                                    <tr key={rule.id} className={isEditing ? 'bg-sky-50' : 'hover:bg-gray-50/70'}>
                                                        {isEditing ? (
                                                            <>
                                                                <td className="p-2"><input type="text" value={tempData.target} onChange={(e) => handleTempChange('target', e.target.value)} className="w-full p-2 border-gray-300 border rounded-md text-s" /></td>
                                                                <td className="p-2"><input type="text" value={tempData.value} onChange={(e) => handleTempChange('value', e.target.value)} className="w-full p-2 border-gray-300 border rounded-md text-s" /></td>
                                                                <td className="p-2"><textarea value={tempData.notes} onChange={(e) => handleTempChange('notes', e.target.value)} className="w-full p-2 border-gray-300 border rounded-md text-s" rows={1} /></td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="px-4 py-3 text-s font-medium text-gray-800">{rule.target}</td>
                                                                <td className="px-4 py-3 text-s font-semibold text-sky-800">{rule.value}</td>
                                                                <td className="px-4 py-3 text-s text-gray-600 italic">{rule.notes}</td>
                                                            </>
                                                        )}
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center space-x-1">
                                                                {isEditing ? (
                                                                    <>
                                                                        <button onClick={() => saveEditing(deptKey)} className="text-green-600 p-2 rounded-full hover:bg-green-100" title="Save"><FiCheck size={16} /></button>
                                                                        <button onClick={cancelEditing} className="text-gray-500 p-2 rounded-full hover:bg-gray-200" title="Cancel"><FiX size={16} /></button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button onClick={() => startEditing(rule)} className="text-sky-600 p-2 rounded-full hover:bg-sky-100" title="Edit"><FiEdit3 size={16} /></button>
                                                                        <button onClick={() => deleteRule(deptKey, rule.id)} className="text-red-500 p-2 rounded-full hover:bg-red-100" title="Delete"><FiTrash2 size={16} /></button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                             {dept.rules.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-4 text-s text-gray-400 italic">No guidelines added for this department yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
			</motion.div>
            
            {/* Footer */}
            <footer className="mt-6 text-center text-x text-gray-500">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 inline-block">
                    <div className="flex items-center justify-center">
                        <FiInfo className="mr-2 text-sky-600"/>
                        <p><span className="font-semibold">Instructions:</span> Please follow these guidelines strictly for all departmental budget submissions. Variances must be justified with clear rationale.</p>
                    </div>
                </div>
            </footer>
		</div>
	);
};

export default CorporateBudgetGuidelines;
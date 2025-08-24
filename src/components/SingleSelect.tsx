"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";

type Option = { label: string; value: string };

export default function SingleSelect({
	label,
	options,
	selected,
	onChange,
	placeholder = "Select an option",
}: {
	label: string;
	options: Option[];
	selected: string;
	onChange: (value: string) => void;
	placeholder?: string;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const containerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (!containerRef.current) return;
			if (!containerRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return options;
		return options.filter((o) => o.label.toLowerCase().includes(q));
	}, [options, query]);

	const selectedOption = options.find(option => option.value === selected);

	return (
		<div ref={containerRef} className="relative inline-block min-w-[12rem] sm:min-w-[14rem]">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full justify-between inline-flex items-center px-2 sm:px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 text-sm"
			>
				<span className="font-medium mr-2 truncate">{label}</span>
				<span className="text-xs sm:text-sm text-gray-500 truncate">
					{selectedOption ? selectedOption.label : placeholder}
				</span>
				<svg className="ml-auto h-4 w-4 text-gray-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.083l3.71-3.85a.75.75 0 111.08 1.04l-4.24 4.4a.75.75 0 01-1.08 0l-4.24-4.4a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
			</button>
			{open && (
				<div className="absolute z-50 mt-2 w-[18rem] sm:w-[20rem] rounded-md border border-gray-200 bg-white shadow-lg">
					<div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
						<div className="flex items-center gap-2">
							<span className="font-medium">{label}</span>
						</div>
					</div>
					<div className="p-2">
						<div className="relative">
							<input
								type="text"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Type to search"
								className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
							/>
						</div>
					</div>
					<div className="max-h-64 overflow-auto">
						{filtered.map((o) => (
							<label 
								key={o.value} 
								className="flex items-center justify-between px-3 py-2 border-t border-gray-100 cursor-pointer hover:bg-gray-50"
							>
								<div className="flex items-center gap-3">
									<input
										type="radio"
										name={label}
										checked={selected === o.value}
										onChange={() => {
											onChange(o.value);
											setOpen(false);
										}}
										className="h-4 w-4"
									/>
									<span>{o.label}</span>
								</div>
							</label>
						))}
						{filtered.length === 0 && (
							<div className="px-3 py-6 text-sm text-gray-500">No options</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

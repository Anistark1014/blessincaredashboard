import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEPT", "OCT", "NOV", "DEC"];

export default function MonthYearPicker({
  onSelect,
}: {
  onSelect: (month: number, year: number) => void;
}) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const [show, setShow] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [yearView, setYearView] = useState(currentYear); // for navigating years

  // Call onSelect when component mounts (initial selection)
  useEffect(() => {
    onSelect(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setShow(!show)}
        className=" px-4 py-2 rounded text-black font-semibold"
      >
        📅 {months[selectedMonth]} {selectedYear}
      </button>

      {/* Dropdown */}
      {show && (
        <div className="absolute mt-2 z-50 bg-[#1c1c1e] text-white rounded-lg p-4 w-[300px] shadow-xl">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium">Pick a Month</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedMonth(currentMonth);
                  setSelectedYear(currentYear);
                  setYearView(currentYear);
                  onSelect(currentMonth, currentYear);
                  setShow(false);
                }}
                className="text-sm px-3 py-1 bg-blue-600 rounded"
              >
                This Month
              </button>
              <button onClick={() => setShow(false)}>
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Year Switch */}
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setYearView((prev) => prev - 1)}>
              <ChevronLeft />
            </button>
            <span className="text-xl font-semibold">{yearView}</span>
            <button onClick={() => setYearView((prev) => prev + 1)}>
              <ChevronRight />
            </button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-4 gap-2">
            {months.map((month, index) => {
              const isSelected = selectedMonth === index && selectedYear === yearView;
              return (
                <button
                  key={month}
                  onClick={() => {
                    setSelectedMonth(index);
                    setSelectedYear(yearView);
                    onSelect(index, yearView);
                    setShow(false);
                  }}
                  className={`px-2 py-1 rounded text-sm ${
                    isSelected
                      ? "bg-blue-600 text-white font-semibold"
                      : "hover:bg-gray-700"
                  }`}
                >
                  {month}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

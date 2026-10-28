import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { BsArrowBarRight } from "react-icons/bs";

const MenuItem = ({ item, isSidebarOpen, level = 0, isLastChild = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;

  const toggleSubmenu = () => {
    setIsOpen(!isOpen);
  };

  // Single Link Item
  if (item.type === "link" && !hasChildren) {
    return (
      <li className={`relative ${level > 0 ? "pl-6" : ""}`}>
        <NavLink
          to={item.path}
          className={({ isActive }) =>
            `flex items-center py-1.5 text-x transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 group ${
              isActive ? "text-sky-900 bg-blue-50" : "text-gray-700 hover:text-blue-600"
            } ${level > 0 ? "pl-6" : "pl-4"}`
          }
        >
          {level > 0 && <BsArrowBarRight className="absolute left-2 text-gray-400 text-x" />}
          {Icon && level === 0 && (
            <span className="mr-2">
              <Icon size="1rem" className="transition-all duration-200" />
            </span>
          )}
          <span className={`${level > 0 ? "text-x" : "text-s"}`}>{item.title}</span>
        </NavLink>
      </li>
    );
  }

  // Submenu Item
  return (
    <li className={`relative ${level > 0 ? "pl-6" : ""}`}>
      <div
        onClick={toggleSubmenu}
        className={`flex items-center justify-between w-full py-1.5 text-x transition-all duration-200 hover:bg-blue-50 hover:text-gray-900 cursor-pointer ${
          isOpen ? "text-sky-700 bg-sky-50" : "text-sky-900"
        } ${level > 0 ? "pl-6" : "pl-4"}`}
      >
        <div className="flex items-center">
          {Icon && level === 0 && (
            <span className="mr-2">
              <Icon size="1rem" className="transition-all duration-200" />
            </span>
          )}
          <span className={`${level > 0 ? "text-x" : "text-s"}`}>{item.title}</span>
        </div>

        {hasChildren && (
          <span>
            {isOpen ? (
              <FiChevronDown className="ml-1" size={14} />
            ) : (
              <FiChevronRight className="ml-1" size={14} />
            )}
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <ul className={`${level > 0 ? "pl-2" : "pl-4"}`}>
          {item.children.map((child, childIndex) => (
            <MenuItem
              key={childIndex}
              item={child}
              isSidebarOpen={isSidebarOpen}
              level={level + 1}
              isLastChild={childIndex === item.children.length - 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default MenuItem;
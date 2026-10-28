import React, { useState, useEffect } from "react"; // Changed: Added useEffect
import { NavLink } from "react-router-dom";
import "./CustomTreeMenu.css";
import {
  FiChevronDown,
  FiChevronRight,
  FiHome,
  FiUser,
  FiClipboard,
  FiGrid,
  FiBarChart2,
  FiBell,
  FiUsers,
  FiSettings,
  FiHelpCircle,
  FiMessageSquare,
  FiFolder,
  FiFile,
  FiTrendingUp,
} from "react-icons/fi";
import { TbWorldUpload } from "react-icons/tb";
import { SlCalculator } from "react-icons/sl";


const iconComponents = {
  FiHome,
  FiUser,
  FiClipboard,
  FiGrid,
  FiBarChart2,
  FiBell,
  FiUsers,
  FiSettings,
  FiHelpCircle,
  FiMessageSquare,
  FiFolder,
  FiFile,
  FiTrendingUp,
  TbWorldUpload,
  SlCalculator,
};

const TreeItem = ({ item, level = 0, isLast = false, activeItem, onItemClick }) => {
  // Changed: Initialize isOpen based on whether activeItem is in the item's hierarchy
  const hasChildren = item.children && item.children.length > 0;
  const isActivePath = (path, children) => {
    if (path === activeItem) return true;
    if (children) {
      return children.some((child) => isActivePath(child.path, child.children));
    }
    return false;
  };
  const [isOpen, setIsOpen] = useState(hasChildren && isActivePath(item.path, item.children));
  const Icon = iconComponents[item.icon?.name] || (hasChildren ? FiFolder : FiFile);

  // Changed: Update isOpen when activeItem changes
  useEffect(() => {
    if (hasChildren && isActivePath(item.path, item.children)) {
      setIsOpen(true);
    }
  }, [activeItem, item.path, hasChildren]);

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
    // Top-level expandable menus (e.g. Planning Engine) should only expand on
    // first click; navigation happens once the user picks a specific child
    // (e.g. Forecasting or Budgeting), not on the parent grouping itself.
    if (level === 0 && hasChildren) {
      return;
    }
    if (item.path && item.path !== "#") {
      onItemClick(item.path);
    }
  };

  return (
    <div className={`tree-item level-${level}`}>
      <div
        className={`tree-item-header ${hasChildren ? "has-children" : ""}`}
        onClick={handleClick}
      >
        {/* Vertical connector line */}
        {level > 0 && (
          <div className={`vertical-connector ${isLast ? "half-height" : ""}`} />
        )}

        {/* Horizontal connector line */}
        {level > 0 && <div className="horizontal-connector" />}

        {/* Chevron icon for expandable items */}
        {hasChildren ? (
          isOpen ? (
            <FiChevronDown className="tree-chevron" />
          ) : (
            <FiChevronRight className="tree-chevron" />
          )
        ) : (
          <span className="tree-chevron-spacer" />
        )}

        {/* Item icon */}
        <Icon className="tree-icon" />

        {/* Item label/link */}
        {item.path ? (
          <NavLink
            to={item.path}
            className={({ isActive }) =>
              `tree-link ${isActive || activeItem === item.path ? "active" : ""}`
            }
            end
            onClick={(e) => {
              if (item.path === "#" || (level === 0 && hasChildren)) {
                e.preventDefault();
              }
            }}
          >
            {item.title}
          </NavLink>
        ) : (
          <span className="tree-label">{item.title}</span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isOpen && (
        <div className="tree-children">
          {item.children.map((child, index) => (
            <TreeItem
              key={index}
              item={child}
              level={level + 1}
              isLast={index === item.children.length - 1}
              activeItem={activeItem}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CustomTreeMenu = ({ items, iconComponents, activeItem, onItemClick }) => {
  return (
    <div className="custom-tree-menu">
      {items.map((item, index) => (
        <TreeItem
          key={index}
          item={item}
          isLast={index === items.length - 1}
          activeItem={activeItem}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
};
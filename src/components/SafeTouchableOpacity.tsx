import React, { ReactElement } from 'react';
import { TouchableOpacity, TouchableOpacityProps, View, ViewProps, Text as RNText } from 'react-native';
import { Text } from 'react-native-paper';

interface SafeTouchableOpacityProps extends TouchableOpacityProps {
  children: React.ReactNode;
}

/**
 * Utility function to ensure text is properly wrapped in Text components
 * This can be used by other components to process their children
 */
export const ensureTextWrapped = (child: React.ReactNode): React.ReactNode => {
  // Handle null/undefined
  if (child === null || child === undefined) {
    return null;
  }
  
  // If it's a string, wrap it in a Text component
  if (typeof child === 'string') {
    return <Text>{child}</Text>;
  }
  
  // Handle numbers and booleans (convert to string)
  if (typeof child === 'number' || typeof child === 'boolean') {
    return <Text>{String(child)}</Text>;
  }
  
  // If it's an array, recursively process each item
  if (Array.isArray(child)) {
    return child.map((item, index) => (
      <React.Fragment key={index}>{ensureTextWrapped(item)}</React.Fragment>
    ));
  }
  
  // If it's a React element with children, process its children
  if (React.isValidElement(child)) {
    const element = child as ReactElement;
    
    // If the element is already a Text component (either RN or Paper), return as is
    if (element.type === Text || element.type === RNText) {
      return element;
    }
    
    const childrenProps = element.props.children;
    
    // If the child is a View or any component that might contain unwrapped text
    if (element.type === View || typeof element.type === 'string' || typeof element.type === 'function') {
      // Only process children if they exist
      if (childrenProps !== undefined && childrenProps !== null) {
        return React.cloneElement(
          element,
          { ...element.props },
          ensureTextWrapped(childrenProps)
        );
      }
    }
    
    // Return the element as is if we didn't handle it above
    return element;
  }
  
  // If it's any other type that we haven't handled, return it as is
  return child;
};

/**
 * A safe wrapper for TouchableOpacity that ensures text is properly wrapped.
 * This helps prevent the "Text strings must be rendered within a <Text> component" error.
 */
const SafeTouchableOpacity: React.FC<SafeTouchableOpacityProps> = ({ 
  children, 
  ...props 
}) => {
  return (
    <TouchableOpacity {...props}>
      {ensureTextWrapped(children)}
    </TouchableOpacity>
  );
};

export default SafeTouchableOpacity; 
import React from 'react';
import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, IconButton, Text } from 'react-native-paper';
import { Entity } from '../types';
import { database } from '../database/Database';

interface EntityCardProps {
  entity: Entity;
  onPress: (id: string) => void;
}

const EntityCard: React.FC<EntityCardProps> = ({ entity, onPress }) => {
  // Function to handle interaction button press
  const handleInteraction = async () => {
    await database.incrementInteractionScore(entity.id);
  };

  // Function to get the icon based on entity type
  const getTypeIcon = () => {
    switch (entity.type) {
      case 'person':
        return 'account';
      case 'group':
        return 'account-group';
      case 'topic':
        return 'tag';
      default:
        return 'help-circle';
    }
  };

  return (
    <Card style={styles.card} onPress={() => onPress(entity.id)}>
      <View style={styles.cardContent}>
        {entity.image ? (
          <Image source={{ uri: entity.image }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>{entity.name.charAt(0)}</Text>
          </View>
        )}
        
        <Card.Content style={styles.textContent}>
          <Title numberOfLines={1} style={styles.title}>{entity.name}</Title>
          <Paragraph numberOfLines={2} style={styles.details}>
            {entity.details || `${entity.type} • Score: ${entity.interaction_score}`}
          </Paragraph>
        </Card.Content>
        
        <View style={styles.iconContainer}>
          <IconButton
            icon={getTypeIcon()}
            size={16}
            style={styles.typeIcon}
          />
          <IconButton
            icon="star"
            size={20}
            onPress={(e) => {
              e.stopPropagation();
              handleInteraction();
            }}
            style={styles.interactionButton}
          />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
    elevation: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6200ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  textContent: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  details: {
    fontSize: 12,
    color: '#666',
  },
  iconContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeIcon: {
    margin: 0,
  },
  interactionButton: {
    margin: 0,
  },
});

export default EntityCard; 
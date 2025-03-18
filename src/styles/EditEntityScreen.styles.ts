import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: 16,
  },
  typeContainer: {
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
  },
  input: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  saveButton: {
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
    borderColor: '#f44336',
  },
  tabs: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  createButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  label: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  iconMenu: {
    marginTop: 40,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  tagText: {
    marginTop: 4,
  },
  actionItem: {
    backgroundColor: '#fff',
    marginVertical: 4,
    borderRadius: 8,
  },
  selectedTagsChip: {
    marginBottom: 8,
  },
  helperText: {
    marginTop: 8,
    marginBottom: 16,
    color: '#666666',
    fontStyle: 'italic',
    fontSize: 14,
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  tagSelectContainer: {
    marginBottom: 8,
  },
  dialogScrollArea: {
    paddingHorizontal: 24,
    maxHeight: '80%', // Limit height to 80% of screen to ensure buttons are visible
  },
  dialogBottomPadding: {
    height: 20,
  },
  actionLoadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    width: 20,
    textAlign: 'center',
  },
  iconOption: {
    padding: 8,
  },
  selectedIconOption: {
    backgroundColor: '#666',
  },
  switchModeButton: {
    marginTop: 8,
    marginBottom: 16,
    alignSelf: 'flex-end',
  },
  importButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    marginLeft: 8,
  },
}); 
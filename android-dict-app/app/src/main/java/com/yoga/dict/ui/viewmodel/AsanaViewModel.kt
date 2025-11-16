package com.yoga.dict.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yoga.dict.data.model.Asana
import com.yoga.dict.data.repository.AsanaRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AsanaViewModel @Inject constructor(
    private val repository: AsanaRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<AsanaUiState>(AsanaUiState.Loading)
    val uiState: StateFlow<AsanaUiState> = _uiState.asStateFlow()
    
    private val _asanaList = MutableStateFlow<List<Asana>>(emptyList())
    val asanaList: StateFlow<List<Asana>> = _asanaList.asStateFlow()
    
    private val _selectedAsana = MutableStateFlow<Asana?>(null)
    val selectedAsana: StateFlow<Asana?> = _selectedAsana.asStateFlow()
    
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()
    
    private val _selectedLetter = MutableStateFlow<String?>(null)
    val selectedLetter: StateFlow<String?> = _selectedLetter.asStateFlow()
    
    init {
        loadAsanas()
    }
    
    fun loadAsanas() {
        viewModelScope.launch {
            _uiState.value = AsanaUiState.Loading
            repository.getAllAsanas()
                .onSuccess { asanas ->
                    _asanaList.value = asanas
                    _uiState.value = AsanaUiState.Success(asanas)
                }
                .onFailure { error ->
                    _uiState.value = AsanaUiState.Error(error.message ?: "Unknown error")
                }
        }
    }
    
    fun loadAsanaById(id: String) {
        viewModelScope.launch {
            _uiState.value = AsanaUiState.Loading
            repository.getAsanaById(id)
                .onSuccess { asana ->
                    _selectedAsana.value = asana
                    _uiState.value = AsanaUiState.Success(listOf(asana))
                }
                .onFailure { error ->
                    _uiState.value = AsanaUiState.Error(error.message ?: "Unknown error")
                }
        }
    }
    
    fun searchAsanas(query: String) {
        _searchQuery.value = query
        if (query.isBlank()) {
            loadAsanas()
            return
        }
        
        viewModelScope.launch {
            _uiState.value = AsanaUiState.Loading
            repository.searchAsanas(query, fuzzy = true)
                .onSuccess { asanas ->
                    _asanaList.value = asanas
                    _uiState.value = AsanaUiState.Success(asanas)
                }
                .onFailure { error ->
                    _uiState.value = AsanaUiState.Error(error.message ?: "Unknown error")
                }
        }
    }
    
    fun filterByLetter(letter: String) {
        _selectedLetter.value = letter
        viewModelScope.launch {
            _uiState.value = AsanaUiState.Loading
            repository.getAsanasByLetter(letter)
                .onSuccess { asanas ->
                    _asanaList.value = asanas
                    _uiState.value = AsanaUiState.Success(asanas)
                }
                .onFailure { error ->
                    _uiState.value = AsanaUiState.Error(error.message ?: "Unknown error")
                }
        }
    }
    
    fun clearFilters() {
        _searchQuery.value = ""
        _selectedLetter.value = null
        loadAsanas()
    }
    
    fun selectAsana(asana: Asana) {
        _selectedAsana.value = asana
    }
}

sealed class AsanaUiState {
    object Loading : AsanaUiState()
    data class Success(val asanas: List<Asana>) : AsanaUiState()
    data class Error(val message: String) : AsanaUiState()
}


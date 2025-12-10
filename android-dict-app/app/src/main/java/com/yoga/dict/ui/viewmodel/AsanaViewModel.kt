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
    
    private val _similarAsanas = MutableStateFlow<List<Asana>>(emptyList())
    val similarAsanas: StateFlow<List<Asana>> = _similarAsanas.asStateFlow()
    
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()
    
    private val _selectedLetter = MutableStateFlow<String?>(null)
    val selectedLetter: StateFlow<String?> = _selectedLetter.asStateFlow()
    
    // Группировка асан по названиям для обычных пользователей
    private val _groupedAsanasByName = MutableStateFlow<Map<String, AsanaNameGroup>>(emptyMap())
    val groupedAsanasByName: StateFlow<Map<String, AsanaNameGroup>> = _groupedAsanasByName.asStateFlow()
    
    init {
        loadAsanas()
    }
    
    fun loadAsanas() {
        viewModelScope.launch {
            _uiState.value = AsanaUiState.Loading
            repository.getAllAsanas()
                .onSuccess { asanas ->
                    _asanaList.value = asanas
                    groupAsanasByName(asanas)
                    _uiState.value = AsanaUiState.Success(asanas)
                }
                .onFailure { error ->
                    _uiState.value = AsanaUiState.Error(error.message ?: "Unknown error")
                }
        }
    }
    
    private fun groupAsanasByName(asanas: List<Asana>) {
        val groups = mutableMapOf<String, AsanaNameGroup>()
        asanas.forEach { asana ->
            val nameKey = asana.name.name_ru.lowercase().trim()
            val group = groups.getOrPut(nameKey) {
                AsanaNameGroup(
                    nameRu = asana.name.name_ru,
                    nameSanskrit = asana.name.name_sanskrit,
                    transliteration = asana.name.transliteration,
                    asanas = mutableListOf()
                )
            }
            (group.asanas as MutableList).add(asana)
        }
        _groupedAsanasByName.value = groups
    }
    
    fun loadAsanaById(id: String) {
        viewModelScope.launch {
            _uiState.value = AsanaUiState.Loading
            repository.getAsanaById(id)
                .onSuccess { asana ->
                    _selectedAsana.value = asana
                    loadSimilarAsanas(asana.id)
                    _uiState.value = AsanaUiState.Success(listOf(asana))
                }
                .onFailure { error ->
                    _uiState.value = AsanaUiState.Error(error.message ?: "Unknown error")
                }
        }
    }
    
    private fun loadSimilarAsanas(asanaId: String) {
        viewModelScope.launch {
            repository.getSimilarAsanas(asanaId)
                .onSuccess { asanas ->
                    _similarAsanas.value = asanas
                }
                .onFailure {
                    _similarAsanas.value = emptyList()
                }
        }
    }
    
    suspend fun getSimilarAsanasForAsana(asanaId: String): List<Asana> {
        return repository.getSimilarAsanas(asanaId).getOrElse { emptyList() }
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
                    groupAsanasByName(asanas)
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
                    groupAsanasByName(asanas)
                    _uiState.value = AsanaUiState.Success(asanas)
                }
                .onFailure { error ->
                    _uiState.value = AsanaUiState.Error(error.message ?: "Unknown error")
                }
        }
    }
    
    fun loadAsanasBySource(sourceId: String) {
        viewModelScope.launch {
            _uiState.value = AsanaUiState.Loading
            repository.getAsanasBySource(sourceId)
                .onSuccess { asanas ->
                    _asanaList.value = asanas
                    groupAsanasByName(asanas)
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
        loadSimilarAsanas(asana.id)
    }
    
    // Методы для работы с isSameAsObject
    fun setSameAsObject(targetAsanaId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        val currentAsana = _selectedAsana.value ?: return
        viewModelScope.launch {
            repository.setSameAsObject(currentAsana.id, targetAsanaId)
                .onSuccess {
                    loadSimilarAsanas(currentAsana.id)
                    onSuccess()
                }
                .onFailure { error ->
                    onError(error.message ?: "Ошибка при указании совпадения")
                }
        }
    }
    
    fun removeSameAsObject(targetAsanaId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        val currentAsana = _selectedAsana.value ?: return
        viewModelScope.launch {
            repository.removeSameAsObject(currentAsana.id, targetAsanaId)
                .onSuccess {
                    loadSimilarAsanas(currentAsana.id)
                    onSuccess()
                }
                .onFailure { error ->
                    onError(error.message ?: "Ошибка при удалении связи")
                }
        }
    }
}

data class AsanaNameGroup(
    val nameRu: String,
    val nameSanskrit: String?,
    val transliteration: String?,
    val asanas: List<Asana>
)

sealed class AsanaUiState {
    object Loading : AsanaUiState()
    data class Success(val asanas: List<Asana>) : AsanaUiState()
    data class Error(val message: String) : AsanaUiState()
}

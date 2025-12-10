package com.yoga.dict.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yoga.dict.data.api.ModerationItem
import com.yoga.dict.data.repository.ModerationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

@HiltViewModel
class ModerationViewModel @Inject constructor(
    private val repository: ModerationRepository
) : ViewModel() {
    
    private val _items = MutableStateFlow<List<ModerationItem>>(emptyList())
    val items: StateFlow<List<ModerationItem>> = _items.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    private val _unresolvedCount = MutableStateFlow(0)
    val unresolvedCount: StateFlow<Int> = _unresolvedCount.asStateFlow()
    
    private val _filterResolved = MutableStateFlow(false)
    val filterResolved: StateFlow<Boolean> = _filterResolved.asStateFlow()
    
    init {
        loadItems()
        loadCount()
    }
    
    fun loadItems() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.getModerationItems(if (_filterResolved.value) null else false)
                .onSuccess { items ->
                    _items.value = items
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
    
    fun loadCount() {
        viewModelScope.launch {
            repository.getModerationItemsCount()
                .onSuccess { count ->
                    _unresolvedCount.value = count
                }
        }
    }
    
    fun setFilterResolved(resolved: Boolean) {
        _filterResolved.value = resolved
        loadItems()
    }
    
    fun addAsanaFromModeration(
        itemId: Int,
        nameId: String,
        sourceId: String,
        photos: List<File>?
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.addAsanaFromModeration(itemId, nameId, sourceId, photos)
                .onSuccess {
                    loadItems()
                    loadCount()
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
    
    fun resolveItem(itemId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.resolveModerationItem(itemId)
                .onSuccess {
                    loadItems()
                    loadCount()
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
    
    fun exportItems() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.exportModerationItems()
                .onSuccess {
                    // TODO: Save file
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
}


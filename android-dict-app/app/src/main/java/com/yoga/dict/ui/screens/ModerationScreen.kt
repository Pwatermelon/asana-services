package com.yoga.dict.ui.screens

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.yoga.dict.data.api.ModerationItem
import com.yoga.dict.ui.viewmodel.ModerationViewModel
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModerationScreen(
    onBack: () -> Unit,
    viewModel: ModerationViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    
    val items by viewModel.items.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val unresolvedCount by viewModel.unresolvedCount.collectAsStateWithLifecycle()
    val filterResolved by viewModel.filterResolved.collectAsStateWithLifecycle()
    
    var selectedItem by remember { mutableStateOf<ModerationItem?>(null) }
    var showResolveDialog by remember { mutableStateOf(false) }
    var selectedNameId by remember { mutableStateOf<String?>(null) }
    var selectedSourceId by remember { mutableStateOf<String?>(null) }
    var selectedPhotos by remember { mutableStateOf<List<Uri>>(emptyList()) }
    
    val imagePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        selectedPhotos = uris
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Модерация")
                        if (unresolvedCount > 0) {
                            Badge {
                                Text("$unresolvedCount")
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.setFilterResolved(!filterResolved) }) {
                        Icon(
                            if (filterResolved) Icons.Default.CheckCircle else Icons.Default.CheckCircleOutline,
                            contentDescription = if (filterResolved) "Показать нерешенные" else "Показать все"
                        )
                    }
                    IconButton(onClick = { viewModel.exportItems() }) {
                        Icon(Icons.Default.Download, contentDescription = "Экспорт")
                    }
                    IconButton(onClick = { viewModel.loadItems() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Обновить")
                    }
                }
            )
        }
    ) { paddingValues ->
        if (isLoading && items.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (items.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Нет записей на модерацию",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(items) { item ->
                    ModerationItemCard(
                        item = item,
                        onClick = { selectedItem = item; showResolveDialog = true }
                    )
                }
            }
        }
        
        error?.let {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Text(
                    text = it,
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }
    }
    
    // Диалог разрешения конфликта
    if (showResolveDialog && selectedItem != null) {
        AlertDialog(
            onDismissRequest = { showResolveDialog = false },
            title = { Text("Разрешить конфликт") },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = selectedItem!!.error_message,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    
                    selectedItem!!.import_data?.let { data ->
                        Text(
                            text = "Данные из импорта:",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold
                        )
                        data.forEach { (key, value) ->
                            Text(
                                text = "$key: $value",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                    
                    // TODO: Добавить выбор названия и источника
                    // TODO: Добавить загрузку фотографий
                }
            },
            confirmButton = {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TextButton(
                        onClick = {
                            viewModel.resolveItem(selectedItem!!.id)
                            showResolveDialog = false
                        }
                    ) {
                        Text("Отклонить")
                    }
                    Button(
                        onClick = {
                            // TODO: Добавить асану из модерации
                            showResolveDialog = false
                        }
                    ) {
                        Text("Добавить асану")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showResolveDialog = false }) {
                    Text("Отмена")
                }
            }
        )
    }
}

@Composable
fun ModerationItemCard(
    item: ModerationItem,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (item.resolved) 
                MaterialTheme.colorScheme.surfaceVariant 
            else 
                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.error_message,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                if (item.resolved) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = "Решено",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
            
            item.asana_name?.let {
                Text(
                    text = "Название: $it",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            
            item.source_id?.let {
                Text(
                    text = "Источник ID: $it",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            
            item.row_number?.let {
                Text(
                    text = "Строка: $it",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            item.moderation_type?.let {
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Text(
                        text = it,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
        }
    }
}
